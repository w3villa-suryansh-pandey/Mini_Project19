const {
	createSubscriptionExpiryJob,
	deleteSubscriptionExpiryJob,
	expireSubscriptions,
	getSubscriptionExpiryJob,
	setSubscriptionExpiryEnabled,
} = require('../services/subscription-expiry.service')

function respondWithError(res, status, message) {
	return res.status(status).json({ error: { message } })
}

async function getExpiryJob(req, res) {
	return res.json({ job: await getSubscriptionExpiryJob() })
}

async function createExpiryJob(req, res) {
	const result = await createSubscriptionExpiryJob()
	if (!result.created) return respondWithError(res, 409, 'The subscription expiry job already exists.')
	return res.status(201).json({ job: result.job })
}

async function deleteExpiryJob(req, res) {
	const deleted = await deleteSubscriptionExpiryJob()
	if (!deleted) return respondWithError(res, 404, 'The subscription expiry job does not exist.')
	return res.json({ message: 'Subscription expiry job deleted.' })
}

async function updateExpiryJob(req, res) {
	if (typeof req.body?.enabled !== 'boolean') {
		return respondWithError(res, 400, 'The enabled value must be true or false.')
	}
	const job = await setSubscriptionExpiryEnabled(req.body.enabled)
	if (!job) return respondWithError(res, 404, 'Create the subscription expiry job before changing its status.')
	return res.json({ job })
}

async function runExpiryJob(req, res) {
	const result = await expireSubscriptions({ force: true })
	if (!result.job) return respondWithError(res, 404, 'Create the subscription expiry job before running it.')
	return res.json(result)
}

module.exports = { createExpiryJob, deleteExpiryJob, getExpiryJob, runExpiryJob, updateExpiryJob }