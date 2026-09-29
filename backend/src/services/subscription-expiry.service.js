const cron = require('node-cron')
const CronJobConfig = require('../../models/CronJobConfig')
const Subscription = require('../../models/Subscription')

const JOB_ID = 'subscription-expiry'
const DEFAULT_JOB = {
	id: JOB_ID,
	name: 'Expire subscriptions',
	description: 'End paid PDF editing access when its purchased duration expires.',
	schedule: 'Every minute',
	enabled: true,
}

let scheduledTask
let isRunning = false

async function ensureSubscriptionExpiryJob() {
	const job = await CronJobConfig.findOneAndUpdate(
		{ id: JOB_ID },
		{ $setOnInsert: DEFAULT_JOB },
		{ upsert: true, new: true, setDefaultsOnInsert: true },
	).lean()
	if (typeof job.deleted === 'boolean') return job
	return CronJobConfig.findOneAndUpdate(
		{ id: JOB_ID },
		{ $set: { deleted: false } },
		{ new: true },
	).lean()
}

function presentJob(job) {
	return {
		id: job.id,
		name: job.name,
		description: job.description,
		schedule: job.schedule,
		status: job.enabled ? 'Enabled' : 'Paused',
		lastRunAt: job.lastRunAt,
		lastExpiredCount: job.lastExpiredCount,
	}
}

async function getSubscriptionExpiryJob() {
	const job = await ensureSubscriptionExpiryJob()
	return job.deleted ? null : presentJob(job)
}

async function setSubscriptionExpiryEnabled(enabled) {
	const job = await CronJobConfig.findOneAndUpdate(
		{ id: JOB_ID, deleted: false },
		{ $set: { enabled } },
		{ new: true },
	).lean()
	return job ? presentJob(job) : null
}

async function createSubscriptionExpiryJob() {
	const existingJob = await CronJobConfig.findOne({ id: JOB_ID }).lean()
	if (existingJob && !existingJob.deleted) return { created: false, job: presentJob(existingJob) }

	if (existingJob) {
		const job = await CronJobConfig.findOneAndUpdate(
			{ id: JOB_ID },
			{ $set: { deleted: false, enabled: true, lastRunAt: null, lastExpiredCount: 0 } },
			{ new: true },
		).lean()
		return { created: true, job: presentJob(job) }
	}

	const job = await CronJobConfig.create(DEFAULT_JOB)
	return { created: true, job: presentJob(job.toObject()) }
}

async function deleteSubscriptionExpiryJob() {
	const result = await CronJobConfig.updateOne(
		{ id: JOB_ID, deleted: { $ne: true } },
		{ $set: { enabled: false, deleted: true } },
	)
	return result.modifiedCount > 0
}

async function expireSubscriptions({ force = false } = {}) {
	if (isRunning) return { skipped: true, expiredCount: 0, job: await getSubscriptionExpiryJob() }
	const job = await CronJobConfig.findOne({ id: JOB_ID, deleted: false }).lean()
	if (!job) return { skipped: true, expiredCount: 0, job: null }
	if (!force && !job.enabled) return { skipped: true, expiredCount: 0, job: presentJob(job) }

	isRunning = true
	try {
		const now = new Date()
		const result = await Subscription.updateMany(
			{ status: 'active', expiresAt: { $lte: now } },
			{ $set: { status: 'expired' } },
		)
		const updatedJob = await CronJobConfig.findOneAndUpdate(
			{ id: JOB_ID },
			{ $set: { lastRunAt: now, lastExpiredCount: result.modifiedCount } },
			{ new: true },
		).lean()
		return { skipped: false, expiredCount: result.modifiedCount, job: presentJob(updatedJob) }
	} finally {
		isRunning = false
	}
}

function startSubscriptionExpiryScheduler() {
	if (scheduledTask) return scheduledTask
	scheduledTask = cron.schedule('* * * * *', () => {
		expireSubscriptions().catch((error) => {
			console.error('Subscription expiry job failed', error.message)
		})
	}, { timezone: 'UTC' })
	return scheduledTask
}

function stopSubscriptionExpiryScheduler() {
	scheduledTask?.stop()
	scheduledTask = undefined
}

module.exports = {
	createSubscriptionExpiryJob,
	deleteSubscriptionExpiryJob,
	expireSubscriptions,
	getSubscriptionExpiryJob,
	ensureSubscriptionExpiryJob,
	setSubscriptionExpiryEnabled,
	startSubscriptionExpiryScheduler,
	stopSubscriptionExpiryScheduler,
}