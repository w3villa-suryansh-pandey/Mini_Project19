process.env.AUTH_TOKEN_SECRET ||= 'test-auth-token-secret-with-more-than-32-characters'
process.env.SMTP_HOST = 'smtp.test'
process.env.SMTP_PORT = '587'
process.env.SMTP_SECURE = 'false'
process.env.SMTP_USER = 'test-user'
process.env.SMTP_PASS = 'test-password'
process.env.SMTP_FROM = 'W3 Tests <test@example.com>'

const assert = require('node:assert/strict')
const nodemailer = require('nodemailer')
const test = require('node:test')
const User = require('../models/User')
const { login, resendVerification, signUp } = require('../src/controllers/auth.controller')
const { hashPassword, hashVerificationToken } = require('../src/utils/auth.utils')

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

function withMockedEmail(sendMail, run) {
	const originalCreateTransport = nodemailer.createTransport
	nodemailer.createTransport = () => ({ sendMail })
	return Promise.resolve()
		.then(run)
		.finally(() => { nodemailer.createTransport = originalCreateTransport })
}

test('signup stores a pending verification token and sends its email link', async () => {
	const originalFindOne = User.findOne
	const originalCreate = User.create
	let createdUser
	let sentEmail
	User.findOne = () => ({ select: async () => null })
	User.create = async (user) => {
		createdUser = { ...user, _id: { toString: () => 'new-user-id' } }
		return createdUser
	}

	try {
		await withMockedEmail(async (message) => { sentEmail = message }, async () => {
			const response = makeResponse()
			await signUp({ body: { name: 'New User', email: 'New@Example.com', password: 'valid-password' } }, response)

			assert.equal(response.statusCode, 201)
			assert.equal(response.body.message, 'Account created. Check your email for a verification link.')
			assert.equal(response.cookies.length, 0)
			assert.equal(createdUser.email, 'new@example.com')
			assert.equal(createdUser.emailVerifiedAt, null)
			assert.equal(createdUser.emailVerificationTokenHash, hashVerificationToken(new URL(sentEmail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token')))
			assert.ok(createdUser.emailVerificationExpiresAt.getTime() > Date.now())
			assert.match(sentEmail.subject, /Verify your W3Villa email address/)
		})
	} finally {
		User.findOne = originalFindOne
		User.create = originalCreate
	}
})

test('resend issues a fresh verification link for an unverified email account', async () => {
	const originalFindOne = User.findOne
	const sentEmails = []
	const user = {
		_id: 'pending-user-id',
		name: 'Pending User',
		email: 'pending@example.com',
		emailVerifiedAt: null,
		authProviders: { email: true },
		isActive: true,
		async save() { this.wasSaved = true },
	}
	User.findOne = () => ({ select: async () => user })

	try {
		await withMockedEmail(async (message) => sentEmails.push(message), async () => {
			const response = makeResponse()
			await resendVerification({ body: { email: user.email } }, response)

			assert.equal(response.statusCode, 200)
			assert.equal(user.wasSaved, true)
			assert.ok(user.emailVerificationTokenHash)
			assert.equal(sentEmails.length, 1)
		})
	} finally {
		User.findOne = originalFindOne
	}
})

test('login refuses an unverified password account', async () => {
	const originalFindOne = User.findOne
	const user = {
		email: 'pending@example.com',
		password: await hashPassword('valid-password'),
		emailVerifiedAt: null,
		authProviders: { email: true },
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