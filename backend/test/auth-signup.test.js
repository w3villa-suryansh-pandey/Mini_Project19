process.env.AUTH_TOKEN_SECRET ||= 'test-auth-token-secret-with-more-than-32-characters'

const assert = require('node:assert/strict')
const test = require('node:test')
const User = require('../models/User')
const { login, signUp } = require('../src/controllers/auth.controller')
const { hashPassword } = require('../src/utils/auth.utils')

function makeResponse() {
	return {
		statusCode: 200,
		body: null,
		cookies: [],
		status(code) {
			this.statusCode = code
			return this
		},
		json(body) {
			this.body = body
			return this
		},
		cookie(...args) {
			this.cookies.push(args)
			return this
		},
	}
}

test('signup creates a verified account and signs the user in without sending email', async () => {
	const originalFindOne = User.findOne
	const originalCreate = User.create
	let createdUser
	User.findOne = () => ({ select: async () => null })
	User.create = async (user) => {
		createdUser = { ...user, _id: { toString: () => 'new-user-id' } }
		return createdUser
	}

	try {
		const response = makeResponse()
		await signUp({ body: { name: 'New User', email: 'New@Example.com', password: 'valid-password' } }, response)

		assert.equal(response.statusCode, 201)
		assert.equal(response.body.message, 'Account created and signed in.')
		assert.equal(response.body.user.email, 'new@example.com')
		assert.equal(createdUser.emailVerifiedAt instanceof Date, true)
		assert.equal(createdUser.emailVerificationTokenHash, undefined)
		assert.equal(response.cookies.length, 1)
	} finally {
		User.findOne = originalFindOne
		User.create = originalCreate
	}
})

test('login allows an active password account without an email verification date', async () => {
	const originalFindOne = User.findOne
	const user = {
		_id: { toString: () => 'existing-user-id' },
		email: 'pending@example.com',
		password: await hashPassword('valid-password'),
		emailVerifiedAt: null,
		isActive: true,
		role: 'user',
	}
	User.findOne = () => ({ select: async () => user })

	try {
		const response = makeResponse()
		await login({ body: { email: user.email, password: 'valid-password', role: 'user' } }, response)

		assert.equal(response.statusCode, 200)
		assert.equal(response.body.user.email, user.email)
		assert.equal(response.cookies.length, 1)
	} finally {
		User.findOne = originalFindOne
	}
})