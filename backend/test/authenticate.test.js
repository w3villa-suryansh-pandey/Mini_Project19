process.env.AUTH_TOKEN_SECRET ||= 'test-auth-token-secret-with-more-than-32-characters'
process.env.NODE_ENV = 'production'

const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const test = require('node:test')
const User = require('../models/User')
const { authTokenSecret } = require('../src/config/env')
const { authenticate, sessionCookieOptions } = require('../src/middleware/authenticate')

function makeResponse() {
	return {
		statusCode: 200,
		body: null,
		status(code) {
			this.statusCode = code
			return this
		},
		json(body) {
			this.body = body
			return this
		},
	}
}

test('production session cookies support cross-site frontend API requests', () => {
	const options = sessionCookieOptions()
	assert.equal(options.sameSite, 'none')
	assert.equal(options.secure, true)
})

test('accepts an active authenticated account without requiring email verification', async () => {
	const originalFindById = User.findById
	User.findById = () => ({
		select() { return this },
		lean: async () => ({
			_id: 'user-1',
			name: 'Google User',
			email: 'google@example.com',
			role: 'user',
			isActive: true,
			emailVerifiedAt: null,
		}),
	})

	const token = jwt.sign({ sub: 'user-1' }, authTokenSecret, { algorithm: 'HS256' })
	const response = makeResponse()
	let nextCalled = false
	try {
		await authenticate(
			{ cookies: { w3villa_session: token } },
			response,
			() => { nextCalled = true },
		)
		assert.equal(nextCalled, true)
		assert.equal(response.statusCode, 200)
	} finally {
		User.findById = originalFindById
	}
})