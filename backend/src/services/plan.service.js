const Plan = require('../../models/Plan')

const PLAN_FEATURES = [
	{ key: 'pdf_editor', label: 'PDF editor and downloads' },
	{ key: 'presentation', label: 'Presentation Studio exports' },
	{ key: 'file_converter', label: 'File converter downloads' },
	{ key: 'file_compressor', label: 'File compressor downloads' },
	{ key: 'image_tools', label: 'Image tool downloads' },
	{ key: 'writing_pad', label: 'Writing Pad downloads' },
]

function legacyFeatureKeys(features = []) {
	return features.some((feature) => /pdf editing|edited pdf/i.test(feature)) ? ['pdf_editor'] : []
}

const DEFAULT_PLANS = [
	{
		id: 'day',
		name: 'Day pass',
		priceInPaise: 1000,
		durationValue: 1,
		durationUnit: 'day',
		features: ['PDF editing tools', 'Edited PDF downloads'],
		featureKeys: ['pdf_editor'],
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
		featureKeys: ['pdf_editor'],
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
		featureKeys: Array.isArray(plan.featureKeys) ? plan.featureKeys : legacyFeatureKeys(plan.features),
		isActive: plan.isActive,
		isArchived: Boolean(plan.isArchived),
	}
}

module.exports = { DEFAULT_PLANS, PLAN_FEATURES, ensureDefaultPlans, legacyFeatureKeys, planForClient }
