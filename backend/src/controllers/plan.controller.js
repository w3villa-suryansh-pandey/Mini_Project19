const { randomUUID } = require('node:crypto')
const Plan = require('../../models/Plan')
const Subscription = require('../../models/Subscription')
const { PLAN_FEATURES, legacyFeatureKeys, planForClient } = require('../services/plan.service')

const DURATION_UNITS = new Set(['hour', 'day', 'week', 'month', 'year'])

function validatePlan(body) {
	const name = typeof body?.name === 'string' ? body.name.trim() : ''
	const price = Number(body?.priceRupees)
	const durationValue = Number(body?.durationValue)
	const durationUnit = body?.durationUnit
	let features = Array.isArray(body?.features)
		? body.features.filter((feature) => typeof feature === 'string').map((feature) => feature.trim()).filter(Boolean).slice(0, 12)
		: []
	const featureKeys = Array.isArray(body?.featureKeys)
		? [...new Set(body.featureKeys.filter((key) => PLAN_FEATURES.some((feature) => feature.key === key)))]
		: legacyFeatureKeys(features)
	if (Array.isArray(body?.featureKeys) && featureKeys.length !== new Set(body.featureKeys).size) return { error: 'Choose only supported plan features.' }
	if (Array.isArray(body?.featureKeys)) {
		features = featureKeys.map((key) => PLAN_FEATURES.find((feature) => feature.key === key).label)
	}

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
			featureKeys,
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

	const lastPlan = await Plan.findOne({}).sort({ sortOrder: -1 }).select('sortOrder').lean()
	const plan = await Plan.create({ id: randomUUID(), sortOrder: (lastPlan?.sortOrder || 0) + 1, ...validation.value })
	return res.status(201).json({ plan: planForClient(plan.toObject()) })
}

async function reorderPlans(req, res) {
	const { planIds } = req.body || {}
	if (!Array.isArray(planIds) || planIds.some((id) => typeof id !== 'string' || !id) || new Set(planIds).size !== planIds.length) {
		return respondWithError(res, 400, 'Provide each plan ID once in the desired order.')
	}

	const existingPlans = await Plan.find({}).select('id').lean()
	const existingIds = new Set(existingPlans.map((plan) => plan.id))
	if (planIds.length !== existingIds.size || planIds.some((id) => !existingIds.has(id))) {
		return respondWithError(res, 409, 'The plan list changed. Refresh the page and try again.')
	}

	if (planIds.length) {
		await Plan.bulkWrite(planIds.map((id, index) => ({
			updateOne: {
				filter: { id },
				update: { $set: { sortOrder: index + 1 } },
			},
		})))
	}

	const plans = await Plan.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean()
	return res.json({ plans: plans.map(planForClient) })
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

module.exports = { createPlan, deletePlan, listAdminPlans, listPlans, reorderPlans, updatePlan, validatePlan }
