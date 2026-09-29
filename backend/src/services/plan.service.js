const Plan = require('../../models/Plan')

const DEFAULT_PLANS = [
	{
		id: 'day',
		name: 'Day pass',
		priceInPaise: 1000,
		durationValue: 1,
		durationUnit: 'day',
		features: ['PDF editing tools', 'Edited PDF downloads'],
		isActive: true,
		sortOrder: 1,
	},
	{
		id: 'month',
		name: 'Monthly pass',
		priceInPaise: 20000,
		durationValue: 1,
		durationUnit: 'month',
		features: ['PDF editing tools', 'Edited PDF downloads'],
		isActive: true,
		sortOrder: 2,
	},
]

async function ensureDefaultPlans() {
	if (await Plan.exists({})) return
	await Plan.insertMany(DEFAULT_PLANS, { ordered: false })
}

function planForClient(plan) {
	return {
		id: plan.id,
		name: plan.name,
		priceInPaise: plan.priceInPaise,
		priceRupees: plan.priceInPaise / 100,
		durationValue: plan.durationValue,
		durationUnit: plan.durationUnit,
		features: plan.features,
		isActive: plan.isActive,
		isArchived: Boolean(plan.isArchived),
	}
}

module.exports = { DEFAULT_PLANS, ensureDefaultPlans, planForClient }