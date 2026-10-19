const assert = require('node:assert/strict')
const test = require('node:test')
const {
	calculateExpiration,
	capturedPaymentDetails,
	subscriptionDetails,
	verifyPaymentSignature,
} = require('../src/controllers/payment.controller')
const Subscription = require('../models/Subscription')
const { validatePlan } = require('../src/controllers/plan.controller')
const { DEFAULT_PLANS } = require('../src/services/plan.service')

test('default day and month passes use the configured INR prices', () => {
	assert.equal(DEFAULT_PLANS.find((plan) => plan.id === 'day').priceInPaise, 1000)
	assert.equal(DEFAULT_PLANS.find((plan) => plan.id === 'month').priceInPaise, 20000)
})

test('day pass expires 24 hours after activation', () => {
	const startsAt = new Date('2026-09-29T12:00:00.000Z')
	const expiresAt = calculateExpiration(1, 'day', startsAt)

	assert.equal(expiresAt.getTime() - startsAt.getTime(), 24 * 60 * 60 * 1000)
})

test('month pass expires one calendar month after activation', () => {
	const startsAt = new Date('2026-09-29T12:00:00.000Z')
	const expiresAt = calculateExpiration(1, 'month', startsAt)

	assert.equal(expiresAt.toISOString(), '2026-10-29T12:00:00.000Z')
})

test('year-end subscription dates clamp to the final day of the target month', () => {
	const startsAt = new Date('2024-02-29T12:00:00.000Z')
	const expiresAt = calculateExpiration(1, 'year', startsAt)

	assert.equal(expiresAt.toISOString(), '2025-02-28T12:00:00.000Z')
})

test('custom plans validate INR amounts and supported durations', () => {
	const result = validatePlan({
		name: 'Weekend access',
		priceRupees: '45.50',
		durationValue: '2',
		durationUnit: 'day',
		features: ['Edit PDFs', 'Download results'],
	})

	assert.equal(result.error, undefined)
	assert.equal(result.value.priceInPaise, 4550)
	assert.equal(result.value.durationValue, 2)
	assert.deepEqual(result.value.features, ['Edit PDFs', 'Download results'])
})

test('custom plans reject invalid prices and unsupported duration units', () => {
	const basePlan = { name: 'Invalid', priceRupees: 10, durationValue: 1, durationUnit: 'day' }
	assert.match(validatePlan({ ...basePlan, priceRupees: 0 }).error, /price/)
	assert.match(validatePlan({ ...basePlan, priceRupees: 10.001 }).error, /price/)
	assert.match(validatePlan({ ...basePlan, durationUnit: 'decade' }).error, /duration/)
})

test('hour-based plan expires by its configured duration', () => {
	const startsAt = new Date('2026-09-29T12:00:00.000Z')
	const expiresAt = calculateExpiration(3, 'hour', startsAt)

	assert.equal(expiresAt.toISOString(), '2026-09-29T15:00:00.000Z')
})

test('subscription access is active only within its paid time window', () => {
	const now = new Date('2026-09-29T12:00:00.000Z')
	const active = subscriptionDetails({
		planId: 'day',
		startsAt: new Date('2026-09-29T11:00:00.000Z'),
		expiresAt: new Date('2026-09-30T11:00:00.000Z'),
	}, now)
	const expired = subscriptionDetails({
		planId: 'day',
		startsAt: new Date('2026-09-28T11:00:00.000Z'),
		expiresAt: new Date('2026-09-29T11:00:00.000Z'),
	}, now)

	assert.equal(active.active, true)
	assert.equal(active.planId, 'day')
	assert.equal(expired.active, false)
	assert.equal(expired.planId, null)
})

test('Razorpay signatures bind a payment to its order', () => {
	const crypto = require('node:crypto')
	const { razorpayKeySecret } = require('../src/config/env')
	const orderId = 'order_123'
	const paymentId = 'pay_123'
	const signature = crypto.createHmac('sha256', razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex')

	assert.equal(verifyPaymentSignature(orderId, paymentId, signature), true)
	const changedSignature = `${signature[0] === '0' ? '1' : '0'}${signature.slice(1)}`
	assert.equal(verifyPaymentSignature(orderId, paymentId, changedSignature), false)
	assert.equal(verifyPaymentSignature(orderId, paymentId, 'invalid'), false)
})

test('captured Razorpay payment details must match the paid order and plan notes', () => {
	const order = {
		id: 'order_123',
		status: 'paid',
		amount: 1000,
		amount_paid: 1000,
		currency: 'INR',
		notes: {
			userId: 'user_123',
			planId: 'day',
			planName: 'Day pass',
			amountInPaise: '1000',
			durationValue: '1',
			durationUnit: 'day',
		},
	}
	const payment = {
		id: 'pay_123',
		order_id: 'order_123',
		status: 'captured',
		amount: 1000,
		currency: 'INR',
	}

	assert.deepEqual(capturedPaymentDetails(order, payment), {
		userId: 'user_123',
		planId: 'day',
		planName: 'Day pass',
		amountInPaise: 1000,
		durationValue: 1,
		durationUnit: 'day',
	})
	assert.equal(capturedPaymentDetails(order, { ...payment, amount: 999 }), null)
	assert.equal(capturedPaymentDetails(order, { ...payment, order_id: 'order_other' }), null)
})

test('Razorpay payment IDs use a sparse unique index for existing subscriptions', () => {
	const paymentIdPath = Subscription.schema.path('razorpayPaymentId')

	assert.equal(paymentIdPath.options.unique, true)
	assert.equal(paymentIdPath.options.sparse, true)
})