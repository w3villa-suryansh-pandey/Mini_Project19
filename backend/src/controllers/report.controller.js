const Subscription = require('../../models/Subscription')
const User = require('../../models/User')

function startOfPeriod(period, date = new Date()) {
	const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
	if (period === 'week') {
		const mondayOffset = (start.getUTCDay() + 6) % 7
		start.setUTCDate(start.getUTCDate() - mondayOffset)
	} else if (period === 'month') {
		start.setUTCDate(1)
	} else {
		start.setUTCMonth(0, 1)
	}
	return start
}

function nextPeriodStart(period, start) {
	const next = new Date(start)
	if (period === 'week') next.setUTCDate(next.getUTCDate() + 7)
	else if (period === 'month') next.setUTCMonth(next.getUTCMonth() + 1)
	else next.setUTCFullYear(next.getUTCFullYear() + 1)
	return next
}

function makeBuckets(period, start, end) {
	const buckets = []
	const cursor = new Date(start)
	while (cursor < end) {
		const bucketStart = new Date(cursor)
		const bucketEnd = new Date(cursor)
		if (period === 'year') bucketEnd.setUTCMonth(bucketEnd.getUTCMonth() + 1)
		else bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 1)
		buckets.push({ start: bucketStart, end: bucketEnd, users: new Set(), subscribers: new Set(), valueInPaise: 0 })
		cursor.setTime(bucketEnd.getTime())
	}
	return buckets
}

async function getAdminReport(req, res) {
	const period = ['week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'month'
	const now = new Date()
	const start = startOfPeriod(period)
	const end = nextPeriodStart(period, start)
	const buckets = makeBuckets(period, start, end)
	const [activeUsers, subscriptions] = await Promise.all([
		User.find({ role: 'user', isActive: true, createdAt: { $gte: start, $lt: end } })
			.select('_id createdAt').lean(),
		Subscription.find({ startsAt: { $lt: end }, expiresAt: { $gt: start } })
			.select('userId planId planName amountInPaise createdAt startsAt expiresAt').lean(),
	])

	for (const user of activeUsers) {
		const bucket = buckets.find(({ start: bucketStart, end: bucketEnd }) => user.createdAt >= bucketStart && user.createdAt < bucketEnd)
		bucket?.users.add(user._id.toString())
	}

	const subscriberIds = [...new Set(subscriptions.map((subscription) => subscription.userId.toString()))]
	const activeSubscriberUsers = subscriberIds.length
		? await User.find({ _id: { $in: subscriberIds }, role: 'user', isActive: true }).select('_id').lean()
		: []
	const activeSubscriberIds = new Set(activeSubscriberUsers.map((user) => user._id.toString()))
	const byPlan = new Map()
	let subscriptionValueInPaise = 0
	let subscriptionCount = 0

	for (const subscription of subscriptions) {
		const userId = subscription.userId.toString()
		const purchasedInPeriod = subscription.createdAt >= start && subscription.createdAt < end
		if (purchasedInPeriod) {
			subscriptionValueInPaise += subscription.amountInPaise
			subscriptionCount += 1
		}

		const planKey = subscription.planId || subscription.planName
		const plan = byPlan.get(planKey) || {
			planId: subscription.planId,
			planName: subscription.planName,
			subscribers: new Set(),
			subscriptionValueInPaise: 0,
			subscriptionCount: 0,
		}
		if (activeSubscriberIds.has(userId)) plan.subscribers.add(userId)
		if (purchasedInPeriod) {
			plan.subscriptionValueInPaise += subscription.amountInPaise
			plan.subscriptionCount += 1
		}
		byPlan.set(planKey, plan)

		for (const bucket of buckets) {
			const snapshotAt = bucket.end < now ? bucket.end : now
			if (bucket.start <= now && subscription.startsAt <= snapshotAt && subscription.expiresAt > snapshotAt && activeSubscriberIds.has(userId)) {
				bucket.subscribers.add(userId)
			}
			if (purchasedInPeriod && subscription.createdAt >= bucket.start && subscription.createdAt < bucket.end) {
				bucket.valueInPaise += subscription.amountInPaise
			}
		}
	}

	return res.json({
		period,
		start,
		end,
		summary: {
			activeUsers: activeUsers.length,
			activeSubscribers: activeSubscriberIds.size,
			subscriptionValueInPaise,
			subscriptionCount,
		},
		plans: [...byPlan.values()]
			.map((plan) => ({ ...plan, subscribers: plan.subscribers.size }))
			.sort((a, b) => b.subscriptionValueInPaise - a.subscriptionValueInPaise || b.subscribers - a.subscribers),
			trend: buckets.map((bucket) => ({
				date: bucket.start,
				activeUsers: bucket.users.size,
				activeSubscribers: bucket.subscribers.size,
				subscriptionValueInPaise: bucket.valueInPaise,
			})),
	})
}

module.exports = { getAdminReport, makeBuckets, nextPeriodStart, startOfPeriod }
