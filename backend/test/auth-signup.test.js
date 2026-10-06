process.env.AUTH_TOKEN_SECRET ||= 'test-auth-token-secret-with-more-than-32-characters'

const assert = require('node:assert/strict')
const test = require('node:test')
const User = require('../models/User')
const { login, resendVerification, signUp, verifyEmail } = require('../src/controllers/auth.controller')
const { hashPassword, hashVerificationToken } = require('../src/utils/auth.utils')
const emailService = require('../src/services/email.service')

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

test('signup creates an unverified account, emails a token, and does not sign in', async () => {
	const originalFindOne = User.findOne
	const originalCreate = User.create
	const originalSendVerificationEmail = emailService.sendVerificationEmail
	let createdUser
	let sentEmail
	User.findOne = () => ({ select: async () => null })
	User.create = async (user) => {
		createdUser = { ...user, _id: { toString: () => 'new-user-id' } }
		return createdUser
	}
	emailService.sendVerificationEmail = async (email) => { sentEmail = email }

	try {
		const response = makeResponse()
		await signUp({ body: { name: 'New User', email: 'New@Example.com', password: 'valid-password' } }, response)

		assert.equal(response.statusCode, 201)
		assert.match(response.body.message, /verification link/)
		assert.equal(createdUser.email, 'new@example.com')
		assert.equal(createdUser.emailVerifiedAt, undefined)
		assert.equal(typeof createdUser.emailVerificationTokenHash, 'string')
		assert.equal(createdUser.emailVerificationExpiresAt instanceof Date, true)
		assert.equal(sentEmail.email, 'new@example.com')
		assert.equal(typeof sentEmail.token, 'string')
		assert.equal(response.cookies.length, 0)
	} finally {
		User.findOne = originalFindOne
		User.create = originalCreate
		emailService.sendVerificationEmail = originalSendVerificationEmail
	}
})

test('login rejects an active password account without an email verification date', async () => {
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

		assert.equal(response.statusCode, 403)
		assert.equal(response.body.error.code, 'EMAIL_NOT_VERIFIED')
		assert.equal(response.cookies.length, 0)
	} finally {
		User.findOne = originalFindOne
	}
})

test('verification accepts a matching token hash and marks the account verified', async () => {
	const originalFindOneAndUpdate = User.findOneAndUpdate
	const verifiedUser = { emailVerifiedAt: new Date() }
	const token = 'a'.repeat(32)
	User.findOneAndUpdate = async (query, update, options) => {
		assert.equal(query.emailVerificationTokenHash, hashVerificationToken(token))
		assert.ok(query.emailVerificationExpiresAt.$gt instanceof Date)
		assert.equal(update.$set.emailVerifiedAt instanceof Date, true)
		assert.equal(update.$unset.emailVerificationTokenHash, 1)
		assert.equal(update.$unset.emailVerificationExpiresAt, 1)
		assert.equal(options.new, true)
		return verifiedUser
	}

	try {
		const response = makeResponse()
		await verifyEmail({ body: { token } }, response)

		assert.equal(response.statusCode, 200)
		assert.match(response.body.message, /Email verified/)
	} finally {
		User.findOneAndUpdate = originalFindOneAndUpdate
	}
})

test('resend rotates the stored token and emails the new verification link', async () => {
	const originalFindOne = User.findOne
	const originalSendVerificationEmail = emailService.sendVerificationEmail
	const user = {
		name: 'Pending User',
		email: 'pending@example.com',
		emailVerifiedAt: null,
		authProviders: { email: true },
		isActive: true,
		async save() { this.saved = true },
	}
	let sentEmail
	User.findOne = () => ({ select: async () => user })
	emailService.sendVerificationEmail = async (email) => { sentEmail = email }

	try {
		const response = makeResponse()
		await resendVerification({ body: { email: user.email } }, response)

		assert.equal(response.statusCode, 200)
		assert.match(response.body.message, /If an unverified account exists/)
		assert.equal(user.saved, true)
		assert.equal(user.emailVerificationExpiresAt instanceof Date, true)
		assert.equal(user.emailVerificationTokenHash, hashVerificationToken(sentEmail.token))
		assert.equal(sentEmail.email, user.email)
	} finally {
		User.findOne = originalFindOne
		emailService.sendVerificationEmail = originalSendVerificationEmail
	}
})