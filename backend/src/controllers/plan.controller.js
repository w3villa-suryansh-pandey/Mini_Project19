const { randomUUID } = require('node:crypto')
const Plan = require('../../models/Plan')
const Subscription = require('../../models/Subscription')
const { planForClient } = require('../services/plan.service')

const DURATION_UNITS = new Set(['hour', 'day', 'week', 'month', 'year'])

function validatePlan(body) {
	const name = typeof body?.name === 'string' ? body.name.trim() : ''
	const price = Number(body?.priceRupees)
	const durationValue = Number(body?.durationValue)
	const durationUnit = body?.durationUnit
	const features = Array.isArray(body?.features)
		? body.features.filter((feature) => typeof feature === 'string').map((feature) => feature.trim()).filter(Boolean).slice(0, 12)
		: []

	if (!name || name.length > 60) return { error: 'Plan name must be 1 to 60 characters.' }
	if (!Number.isFinite(price) || price < 1 || price > 1_000_000 || Math.round(price * 100) !== price * 100) {
		return { error: 'Plan price must be from ₹1 to ₹10,00,000 with up to two decimal places.' }
	}
	if (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 3650 || !DURATION_UNITS.has(durationUnit)) {
		return { error: 'Choose a duration from 1 to 3650 hours, days, weeks, months, or years.' }
	}
	if (features.some((feature) => feature.length > 100)) return { error: 'Each feature must be 100 characters or fewer.' }

	return {
		value: {
			name,
			priceInPaise: Math.round(price * 100),
			durationValue,
			durationUnit,
			features,
			isActive: body.isActive !== false,
		},
	}
}

function respondWithError(res, status, message) {
	return res.status(status).json({ error: { message } })
}

async function listPlans(req, res) {
	const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1, priceInPaise: 1 }).lean()
	return res.json({ plans: plans.map(planForClient) })
}

async function listAdminPlans(req, res) {
	const plans = await Plan.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean()
	return res.json({ plans: plans.map(planForClient) })
}

async function createPlan(req, res) {
	const validation = validatePlan(req.body)
	if (validation.error) return respondWithError(res, 400, validation.error)

	const plan = await Plan.create({ id: randomUUID(), ...validation.value })
	return res.status(201).json({ plan: planForClient(plan.toObject()) })
}

async function updatePlan(req, res) {
	const validation = validatePlan(req.body)
	if (validation.error) return respondWithError(res, 400, validation.error)

	const plan = await Plan.findOneAndUpdate({ id: req.params.planId }, { $set: { ...validation.value, isArchived: false } }, {
		new: true,
		runValidators: true,
	}).lean()
	if (!plan) return respondWithError(res, 404, 'Plan not found.')
	return res.json({ plan: planForClient(plan) })
}

async function deletePlan(req, res) {
	const plan = await Plan.findOne({ id: req.params.planId })
	if (!plan) return respondWithError(res, 404, 'Plan not found.')

	const hasSubscriptions = await Subscription.exists({ planId: plan.id })
	if (hasSubscriptions) {
		plan.isActive = false
		plan.isArchived = true
		await plan.save()
		return res.json({ message: 'Plan removed from the catalog. Existing subscription records are retained.', archived: true })
	}

	await plan.deleteOne()
	return res.json({ message: 'Plan deleted.', archived: false })
}

module.exports = { createPlan, deletePlan, listAdminPlans, listPlans, updatePlan, validatePlan }