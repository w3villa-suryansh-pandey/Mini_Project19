const express = require('express')
const { authenticate } = require('../middleware/authenticate')
const requireRole = require('../middleware/require-role')
const {
	confirmRazorpayPayment,
	createCheckoutOrder,
	getSubscription,
} = require('../controllers/payment.controller')

const router = express.Router()

router.use(authenticate, requireRole('user'))
router.get('/subscription', getSubscription)
router.post('/checkout', createCheckoutOrder)
router.post('/confirm', confirmRazorpayPayment)

module.exports = router