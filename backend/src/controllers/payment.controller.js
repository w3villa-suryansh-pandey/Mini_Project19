const Stripe = require('stripe')
const Plan = require('../../models/Plan')
const Subscription = require('../../models/Subscription')
const { clientOrigins, stripeSecretKey, stripeWebhookSecret } = require('../config/env')

const DURATION_UNITS = new Set(['hour', 'day', 'week', 'month', 'year'])

let stripeClient

function getStripe() {
	if (!stripeSecretKey) return null
	if (!stripeClient) stripeClient = new Stripe(stripeSecretKey)
	return stripeClient
}

function calculateExpiration(durationValue, durationUnit, startsAt) {
	const expiresAt = new Date(startsAt)
	if (durationUnit === 'hour') expiresAt.setUTCHours(expiresAt.getUTCHours() + durationValue)
	else if (durationUnit === 'day') expiresAt.setUTCDate(expiresAt.getUTCDate() + durationValue)
	else if (durationUnit === 'week') expiresAt.setUTCDate(expiresAt.getUTCDate() + durationValue * 7)
	else {
		const originalDay = expiresAt.getUTCDate()
		expiresAt.setUTCDate(1)
		if (durationUnit === 'month') expiresAt.setUTCMonth(expiresAt.getUTCMonth() + durationValue)
		else if (durationUnit === 'year') expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + durationValue)
		else throw new Error('Unsupported subscription duration unit.')
		const lastDay = new Date(Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth() + 1, 0)).getUTCDate()
		expiresAt.setUTCDate(Math.min(originalDay, lastDay))
	}
	return expiresAt
}

function subscriptionDetails(subscription, now = new Date()) {
	const active = Boolean(subscription && subscription.startsAt <= now && subscription.expiresAt > now)
	return {
		active,
		planId: active ? subscription.planId : null,
		planName: active ? subscription.planName : null,
		startsAt: active ? subscription.startsAt : null,
		expiresAt: active ? subscription.expiresAt : null,
	}
}

async function findActiveSubscription(userId) {
	return Subscription.findOne({
		userId,
		status: 'active',
		startsAt: { $lte: new Date() },
		expiresAt: { $gt: new Date() },
	}).sort({ expiresAt: -1 }).lean()
}

async function savePaidSession(session) {
	const metadata = session.metadata || {}
	const planId = metadata.planId
	const planName = metadata.planName
	const userId = session.metadata?.userId
	const amountInPaise = Number(metadata.amountInPaise)
	const durationValue = Number(metadata.durationValue)
	const durationUnit = metadata.durationUnit
	if (
		!planId || !planName || !userId || session.client_reference_id !== userId ||
		session.mode !== 'payment' || session.payment_status !== 'paid' ||
		!Number.isInteger(amountInPaise) || session.amount_total !== amountInPaise || session.currency !== 'inr' ||
		!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 3650 || !DURATION_UNITS.has(durationUnit)
	) {
		return null
	}

	const startsAt = new Date()

	try {
		return await Subscription.findOneAndUpdate(
			{ stripeCheckoutSessionId: session.id },
			{
				$setOnInsert: {
					userId,
					stripeCheckoutSessionId: session.id,
					planId,
					planName,
					amountInPaise,
					currency: 'inr',
					durationValue,
					durationUnit,
					startsAt,
					expiresAt: calculateExpiration(durationValue, durationUnit, startsAt),
					status: 'active',
				},
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true },
		).lean()
	} catch (error) {
		if (error.code !== 11000) throw error
		return Subscription.findOne({ stripeCheckoutSessionId: session.id }).lean()
	}
}

function respondWithError(res, status, message) {
	return res.status(status).json({ error: { message } })
}

async function createCheckoutSession(req, res) {
	const planId = typeof req.body?.planId === 'string' ? req.body.planId : ''
	const plan = await Plan.findOne({ id: planId, isActive: true }).lean()
	if (!plan) return respondWithError(res, 400, 'Choose a valid subscription plan.')

	const stripe = getStripe()
	if (!stripe) return respondWithError(res, 503, 'Stripe payments are not configured yet.')

	const origin = req.get('origin')
	if (!clientOrigins.includes(origin)) {
		return respondWithError(res, 403, 'This frontend origin is not allowed to start checkout.')
	}

	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		customer_email: req.user.email,
		client_reference_id: req.user._id.toString(),
		metadata: {
			userId: req.user._id.toString(),
			planId: plan.id,
			planName: plan.name,
			amountInPaise: String(plan.priceInPaise),
			durationValue: String(plan.durationValue),
			durationUnit: plan.durationUnit,
		},
		line_items: [{
			price_data: {
				currency: 'inr',
				unit_amount: plan.priceInPaise,
				product_data: { name: plan.name },
			},
			quantity: 1,
		}],
		success_url: `${origin}/payment?payment=success&session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/payment?payment=cancelled&plan=${encodeURIComponent(plan.id)}`,
	})

	return res.json({ checkoutUrl: session.url })
}

async function confirmCheckoutSession(req, res) {
	const stripe = getStripe()
	if (!stripe) return respondWithError(res, 503, 'Stripe payments are not configured yet.')

	const sessionId = req.body?.sessionId
	if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
		return respondWithError(res, 400, 'A valid checkout session is required.')
	}

	const session = await stripe.checkout.sessions.retrieve(sessionId)
	const userId = req.user._id.toString()
	if (session.client_reference_id !== userId || session.metadata?.userId !== userId) {
		return respondWithError(res, 404, 'The checkout session could not be found for this account.')
	}
	if (session.payment_status !== 'paid') {
		return res.status(202).json({ subscription: subscriptionDetails(await findActiveSubscription(userId)) })
	}

	const savedSession = await savePaidSession(session)
	if (!savedSession) return respondWithError(res, 400, 'The paid session does not match an available plan.')

	return res.json({ subscription: subscriptionDetails(await findActiveSubscription(userId)) })
}

async function getSubscription(req, res) {
	return res.json({ subscription: subscriptionDetails(await findActiveSubscription(req.user._id)) })
}

async function handleStripeWebhook(req, res) {
	const stripe = getStripe()
	if (!stripe || !stripeWebhookSecret) {
		return respondWithError(res, 503, 'Stripe webhooks are not configured yet.')
	}

	let event
	try {
		event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), stripeWebhookSecret)
	} catch {
		return respondWithError(res, 400, 'Stripe webhook signature verification failed.')
	}

	if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
		await savePaidSession(event.data.object)
	}
	return res.json({ received: true })
}

module.exports = {
	calculateExpiration,
	confirmCheckoutSession,
	createCheckoutSession,
	getSubscription,
	handleStripeWebhook,
	subscriptionDetails,
}