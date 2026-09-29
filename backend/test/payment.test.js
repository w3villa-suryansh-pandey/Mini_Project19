const assert = require('node:assert/strict')
const test = require('node:test')
const { calculateExpiration, subscriptionDetails } = require('../src/controllers/payment.controller')
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