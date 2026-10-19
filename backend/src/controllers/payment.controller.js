const crypto = require('node:crypto')
const Razorpay = require('razorpay')
const Plan = require('../../models/Plan')
const Subscription = require('../../models/Subscription')
const {
	clientOrigins,
	razorpayKeyId,
	razorpayKeySecret,
	razorpayWebhookSecret,
} = require('../config/env')
const { findActiveSubscription, subscriptionDetails } = require('../services/subscription.service')
const { PLAN_FEATURES, planForClient } = require('../services/plan.service')

const DURATION_UNITS = new Set(['hour', 'day', 'week', 'month', 'year'])

let razorpayClient

function getRazorpay() {
	if (!razorpayKeyId || !razorpayKeySecret) return null
	if (!razorpayClient) {
		razorpayClient = new Razorpay({
			key_id: razorpayKeyId,
			key_secret: razorpayKeySecret,
		})
	}
	return razorpayClient
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

function verifyPaymentSignature(orderId, paymentId, signature) {
	if (
		typeof orderId !== 'string' || !orderId ||
		typeof paymentId !== 'string' || !paymentId ||
		typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)
	) {
		return false
	}

	const expected = crypto
		.createHmac('sha256', razorpayKeySecret)
		.update(`${orderId}|${paymentId}`)
		.digest()
	const actual = Buffer.from(signature, 'hex')
	return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function capturedPaymentDetails(order, payment) {
	const notes = order?.notes || {}
	const amountInPaise = Number(notes.amountInPaise)
	const durationValue = Number(notes.durationValue)
	const userId = notes.userId
	const planId = notes.planId
	const planName = notes.planName
	if (
		!order?.id || !payment?.id || payment.order_id !== order.id ||
		order.status !== 'paid' || payment.status !== 'captured' ||
		!userId || !planId || !planName ||
		!Number.isInteger(amountInPaise) || amountInPaise < 1 ||
		order.amount !== amountInPaise || order.amount_paid !== amountInPaise ||
		payment.amount !== amountInPaise ||
		String(order.currency).toLowerCase() !== 'inr' ||
		String(payment.currency).toLowerCase() !== 'inr' ||
		!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 3650 ||
		!DURATION_UNITS.has(notes.durationUnit)
	) {
		return null
	}

	return { userId, planId, planName, amountInPaise, durationValue, durationUnit: notes.durationUnit }
}

async function saveCapturedPayment(order, payment) {
	const details = capturedPaymentDetails(order, payment)
	if (!details) return null
	let featureKeys = ['pdf_editor']
	if (typeof order.notes?.featureKeys === 'string') {
		try {
			const parsedKeys = JSON.parse(order.notes.featureKeys)
			featureKeys = Array.isArray(parsedKeys) ? [...new Set(parsedKeys.filter((key) => PLAN_FEATURES.some((feature) => feature.key === key)))] : []
		} catch {
			return null
		}
	}

	const startsAt = new Date()
	try {
		return await Subscription.findOneAndUpdate(
			{ razorpayPaymentId: payment.id },
			{
				$setOnInsert: {
					userId: details.userId,
					razorpayPaymentId: payment.id,
					planId: details.planId,
					planName: details.planName,
					featureKeys,
					amountInPaise: details.amountInPaise,
					currency: 'inr',
					durationValue: details.durationValue,
					durationUnit: details.durationUnit,
					startsAt,
					expiresAt: calculateExpiration(details.durationValue, details.durationUnit, startsAt),
					status: 'active',
				},
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true },
		).lean()
	} catch (error) {
		if (error.code !== 11000) throw error
		return Subscription.findOne({ razorpayPaymentId: payment.id }).lean()
	}
}

async function captureAuthorizedPayment(razorpay, order, payment, expectedUserId) {
	const notes = order?.notes || {}
	const expectedAmount = Number(notes.amountInPaise)
	if (
		payment?.status !== 'authorized' || !payment.id || payment.order_id !== order?.id ||
		(expectedUserId && notes.userId !== expectedUserId) ||
		!Number.isInteger(expectedAmount) || expectedAmount < 1 ||
		order.amount !== expectedAmount || payment.amount !== expectedAmount ||
		String(order.currency).toLowerCase() !== 'inr' ||
		String(payment.currency).toLowerCase() !== 'inr'
	) return { order, payment }

	try {
		await razorpay.payments.capture(payment.id, expectedAmount, 'INR')
	} catch (captureError) {
		// A capture webhook and the browser confirmation can arrive together. Re-fetch
		// before surfacing an error so an already captured payment still completes.
		const refreshedPayment = await razorpay.payments.fetch(payment.id)
		if (refreshedPayment.status !== 'captured') throw captureError
	}

	const [refreshedOrder, refreshedPayment] = await Promise.all([
		razorpay.orders.fetch(order.id),
		razorpay.payments.fetch(payment.id),
	])
	return { order: refreshedOrder, payment: refreshedPayment }
}

function respondWithError(res, status, message) {
	return res.status(status).json({ error: { message } })
}

async function createCheckoutOrder(req, res) {
	const planId = typeof req.body?.planId === 'string' ? req.body.planId : ''
	const plan = await Plan.findOne({ id: planId, isActive: true }).lean()
	if (!plan) return respondWithError(res, 400, 'Choose a valid subscription plan.')
	if (!Number.isInteger(plan.priceInPaise) || plan.priceInPaise < 100) {
		return respondWithError(res, 400, 'The selected plan must cost at least ₹1.00.')
	}

	const razorpay = getRazorpay()
	if (!razorpay) return respondWithError(res, 503, 'Razorpay payments are not configured yet.')

	const origin = req.get('origin')
	if (!clientOrigins.includes(origin)) {
		return respondWithError(res, 403, 'This frontend origin is not allowed to start checkout.')
	}

	const userId = req.user._id.toString()
	const order = await razorpay.orders.create({
		amount: plan.priceInPaise,
		currency: 'INR',
		receipt: `plan-${crypto.randomUUID().replaceAll('-', '')}`,
		notes: {
			userId,
			planId: plan.id,
			planName: plan.name,
			featureKeys: JSON.stringify(planForClient(plan).featureKeys),
			amountInPaise: String(plan.priceInPaise),
			durationValue: String(plan.durationValue),
			durationUnit: plan.durationUnit,
		},
	})

	return res.json({
		keyId: razorpayKeyId,
		order: {
			id: order.id,
			amount: order.amount,
			currency: order.currency,
		},
		name: plan.name,
		description: `${plan.name} PDF editing pass`,
		email: req.user.email,
	})
}

async function confirmRazorpayPayment(req, res) {
	const razorpay = getRazorpay()
	if (!razorpay) return respondWithError(res, 503, 'Razorpay payments are not configured yet.')

	const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {}
	if (!verifyPaymentSignature(orderId, paymentId, signature)) {
		return respondWithError(res, 400, 'Razorpay payment signature verification failed.')
	}

	const order = await razorpay.orders.fetch(orderId)
	const userId = req.user._id.toString()
	if (order.notes?.userId !== userId) {
		return respondWithError(res, 404, 'The payment could not be found for this account.')
	}

	let payment = await razorpay.payments.fetch(paymentId)
	if (payment.order_id !== orderId) {
		return respondWithError(res, 400, 'The payment does not match its Razorpay order.')
	}
	if (payment.status === 'authorized') {
		({ order, payment } = await captureAuthorizedPayment(razorpay, order, payment, userId))
	}
	if (payment.status !== 'captured') {
		return res.status(202).json({
			pending: true,
			subscription: subscriptionDetails(await findActiveSubscription(userId)),
		})
	}

	const savedPayment = await saveCapturedPayment(order, payment)
	if (!savedPayment) return respondWithError(res, 400, 'The captured payment does not match the order.')

	return res.json({ subscription: subscriptionDetails(await findActiveSubscription(userId)) })
}

async function getSubscription(req, res) {
	const [activeSubscription, latestPurchase] = await Promise.all([
		findActiveSubscription(req.user._id),
		Subscription.findOne({ userId: req.user._id })
			.sort({ createdAt: -1 })
			.select('planId planName createdAt')
			.lean(),
	])
	return res.json({
		subscription: subscriptionDetails(activeSubscription),
		lastPurchasedPlan: latestPurchase ? {
			planId: latestPurchase.planId,
			planName: latestPurchase.planName,
			purchasedAt: latestPurchase.createdAt,
		} : null,
	})
}

async function handleRazorpayWebhook(req, res) {
	const razorpay = getRazorpay()
	if (!razorpay || !razorpayWebhookSecret) {
		return respondWithError(res, 503, 'Razorpay webhooks are not configured yet.')
	}
	if (!Buffer.isBuffer(req.body)) {
		return respondWithError(res, 400, 'Razorpay webhook body must be raw JSON.')
	}

	const signature = req.get('x-razorpay-signature')
	const expected = crypto.createHmac('sha256', razorpayWebhookSecret).update(req.body).digest()
	const actual = typeof signature === 'string' && /^[a-f\d]{64}$/i.test(signature)
		? Buffer.from(signature, 'hex')
		: Buffer.alloc(0)
	if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
		return respondWithError(res, 400, 'Razorpay webhook signature verification failed.')
	}

	const event = JSON.parse(req.body.toString('utf8'))
	if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
		let payment = event.payload?.payment?.entity
		if (!payment?.order_id || !payment.id) {
			return respondWithError(res, 400, 'The Razorpay webhook did not contain a valid payment.')
		}
		let order = await razorpay.orders.fetch(payment.order_id)
		if (event.event === 'payment.authorized') {
			payment = await razorpay.payments.fetch(payment.id)
			({ order, payment } = await captureAuthorizedPayment(razorpay, order, payment))
		}
		if (payment.status !== 'captured') return res.json({ received: true })
		const savedPayment = await saveCapturedPayment(order, payment)
		if (!savedPayment) return respondWithError(res, 400, 'The payment does not match its Razorpay order.')
	}

	return res.json({ received: true })
}

module.exports = {
	calculateExpiration,
	capturedPaymentDetails,
	captureAuthorizedPayment,
	confirmRazorpayPayment,
	createCheckoutOrder,
	getSubscription,
	handleRazorpayWebhook,
	subscriptionDetails,
	verifyPaymentSignature,
}
