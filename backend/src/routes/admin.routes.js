const express = require('express')
const Subscription = require('../../models/Subscription')
const User = require('../../models/User')
const { createExpiryJob, deleteExpiryJob, getExpiryJob, runExpiryJob, updateExpiryJob } = require('../controllers/cronjob.controller')
const { createPlan, deletePlan, listAdminPlans, updatePlan } = require('../controllers/plan.controller')
const { authenticate } = require('../middleware/authenticate')
const requireRole = require('../middleware/require-role')

const router = express.Router()

router.use(authenticate, requireRole('admin'))

router.get('/', (req, res) => {
	res.json({
		message: 'Admin access granted',
	})
})

router.get('/users', async (req, res) => {
	const users = await User.find({ role: 'user' })
		.select('_id name email isActive createdAt')
		.sort({ createdAt: -1 })
		.lean()

	return res.json({
		users: users.map((user) => ({
			id: user._id.toString(),
			name: user.name,
			email: user.email,
			status: user.isActive ? 'Active' : 'Inactive',
			createdAt: user.createdAt,
		})),
	})
})

router.get('/subscriptions/active-count', async (req, res) => {
	const now = new Date()
	const userIds = await Subscription.distinct('userId', {
		status: 'active',
		startsAt: { $lte: now },
		expiresAt: { $gt: now },
	})
	const count = await User.countDocuments({ _id: { $in: userIds }, role: 'user', isActive: true })
	return res.json({ count })
})

router.get('/plans', listAdminPlans)
router.post('/plans', createPlan)
router.patch('/plans/:planId', updatePlan)
router.delete('/plans/:planId', deletePlan)
router.get('/cronjobs/subscription-expiry', getExpiryJob)
router.post('/cronjobs/subscription-expiry', createExpiryJob)
router.patch('/cronjobs/subscription-expiry', updateExpiryJob)
router.delete('/cronjobs/subscription-expiry', deleteExpiryJob)
router.post('/cronjobs/subscription-expiry/run', runExpiryJob)

module.exports = router