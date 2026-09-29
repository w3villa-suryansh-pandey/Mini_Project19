const express = require('express')
const { authenticate } = require('../middleware/authenticate')
const requireRole = require('../middleware/require-role')
const {
	confirmCheckoutSession,
	createCheckoutSession,
	getSubscription,
} = require('../controllers/payment.controller')

const router = express.Router()

router.use(authenticate, requireRole('user'))
router.get('/subscription', getSubscription)
router.post('/checkout', createCheckoutSession)
router.post('/confirm', confirmCheckoutSession)

module.exports = router