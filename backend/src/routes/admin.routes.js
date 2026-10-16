const express = require('express')
const mongoose = require('mongoose')
const Subscription = require('../../models/Subscription')
const User = require('../../models/User')
const { createExpiryJob, deleteExpiryJob, getExpiryJob, runExpiryJob, updateExpiryJob } = require('../controllers/cronjob.controller')
const { createPlan, deletePlan, listAdminPlans, updatePlan } = require('../controllers/plan.controller')
const { getAdminProfile, updateAdminProfile } = require('../controllers/admin-profile.controller')
const { getAdminReport } = require('../controllers/report.controller')
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

router.get('/users/:userId', async (req, res) => {
	if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
		return res.status(404).json({ error: { message: 'User not found.' } })
	}
	const user = await User.findOne({ _id: req.params.userId, role: 'user' })
		.select('_id name email phone address company jobTitle bio profilePicture googleId facebookId isActive createdAt lastLoginAt')
		.lean()
	if (!user) return res.status(404).json({ error: { message: 'User not found.' } })

	const purchases = await Subscription.find({ userId: user._id })
		.sort({ createdAt: -1 })
		.select('planId planName featureKeys durationValue durationUnit amountInPaise currency status createdAt startsAt expiresAt')
		.lean()
	const purchaseHistory = purchases.map((purchase) => ({
		id: purchase._id.toString(),
		planId: purchase.planId,
		planName: purchase.planName,
		featureKeys: purchase.featureKeys || [],
		durationValue: purchase.durationValue,
		durationUnit: purchase.durationUnit,
		amountInPaise: purchase.amountInPaise,
		currency: purchase.currency,
		status: purchase.expiresAt > new Date() && purchase.startsAt <= new Date() ? 'active' : 'expired',
		purchasedAt: purchase.createdAt,
		startsAt: purchase.startsAt,
		expiresAt: purchase.expiresAt,
	}))
	return res.json({
		user: {
			id: user._id.toString(),
			name: user.name,
			email: user.email,
			phone: user.phone || '',
			address: typeof user.address === 'string' ? user.address : Object.values(user.address || {}).filter(Boolean).join(', '),
			company: user.company || '',
			jobTitle: user.jobTitle || '',
			bio: user.bio || '',
			profilePicture: user.profilePicture || '',
			googleLinked: Boolean(user.googleId),
			facebookLinked: Boolean(user.facebookId),
			status: user.isActive ? 'Active' : 'Inactive',
			createdAt: user.createdAt,
			lastLoginAt: user.lastLoginAt || null,
		},
		purchases: purchaseHistory,
		lastPurchase: purchaseHistory[0] || null,
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

router.get('/reports', getAdminReport)

router.get('/plans', listAdminPlans)
router.get('/profile', getAdminProfile)
router.patch('/profile', updateAdminProfile)
router.post('/plans', createPlan)
router.patch('/plans/:planId', updatePlan)
router.delete('/plans/:planId', deletePlan)
router.get('/cronjobs/subscription-expiry', getExpiryJob)
router.post('/cronjobs/subscription-expiry', createExpiryJob)
router.patch('/cronjobs/subscription-expiry', updateExpiryJob)
router.delete('/cronjobs/subscription-expiry', deleteExpiryJob)
router.post('/cronjobs/subscription-expiry/run', runExpiryJob)

module.exports = router
