const Subscription = require('../../models/Subscription')

function subscriptionDetails(subscription, now = new Date()) {
	const active = Boolean(subscription && subscription.startsAt <= now && subscription.expiresAt > now)
	const featureKeys = active
		? Array.isArray(subscription.featureKeys) ? subscription.featureKeys : ['pdf_editor']
		: []
	return {
		active,
		planId: active ? subscription.planId : null,
		planName: active ? subscription.planName : null,
		startsAt: active ? subscription.startsAt : null,
		expiresAt: active ? subscription.expiresAt : null,
		featureKeys,
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

module.exports = { findActiveSubscription, subscriptionDetails }
