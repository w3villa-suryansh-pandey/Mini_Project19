const express = require('express')
const adminRoutes = require('./admin.routes')
const authRoutes = require('./auth.routes')
const healthRoutes = require('./health.routes')
const paymentRoutes = require('./payment.routes')
const planRoutes = require('./plan.routes')
const userRoutes = require('./user.routes')

const router = express.Router()

router.get('/', (req, res) => {
	res.json({
		name: 'W3Villa API',
		version: '1.0.0',
		health: '/api/health',
	})
})
router.use('/health', healthRoutes)
router.use('/plans', planRoutes)
router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/payments', paymentRoutes)
router.use('/admin', adminRoutes)

module.exports = router