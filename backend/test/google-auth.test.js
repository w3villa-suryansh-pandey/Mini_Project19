const assert = require('node:assert/strict')
const test = require('node:test')
const User = require('../models/User')
const { linkGoogleUser, resolveGoogleUser } = require('../src/controllers/google-auth.controller')

test('links a Google account to an existing email/password account', async () => {
	const originalFindOne = User.findOne
	let saved = false
	const passwordHash = 'existing-bcrypt-hash'
	const existingUser = {
		_id: 'existing-password-user',
		email: 'existing@example.com',
		googleId: undefined,
		role: 'user',
		password: passwordHash,
		emailVerifiedAt: null,
		authProviders: { email: true, google: false },
		isActive: true,
		async save() { saved = true },
	}

	User.findOne = (query) => {
		assert.deepEqual(query.$or, [
			{ googleId: 'google-subject-1' },
			{ email: 'existing@example.com' },
		])
		return { select: async () => existingUser }
	}

	try {
		const user = await resolveGoogleUser({
			id: 'google-subject-1',
			displayName: 'Existing User',
			emails: [{ value: 'Existing@Example.com', verified: true }],
			_json: { email_verified: true },
		})

		assert.equal(user, existingUser)
		assert.equal(user.googleId, 'google-subject-1')
		assert.equal(user.authProviders.email, true)
		assert.equal(user.authProviders.google, true)
		assert.equal(user.role, 'user')
		assert.equal(user.password, passwordHash)
		assert.equal(user.emailVerifiedAt instanceof Date, true)
		assert.equal(saved, true)
	} finally {
		User.findOne = originalFindOne
	}
})

test('links a different verified Google address only to the authenticated account', async () => {
	const originalFindById = User.findById
	const originalFindOne = User.findOne
	const passwordHash = 'existing-bcrypt-hash'
	const existingUser = {
		_id: { toString: () => 'authenticated-user-id' },
		email: 'local-account@example.com',
		googleId: undefined,
		role: 'user',
		password: passwordHash,
		authProviders: { email: true, google: false },
		isActive: true,
		async save() { this.wasSaved = true },
	}

	User.findById = (userId) => {
		assert.equal(userId, 'authenticated-user-id')
		return { select: async () => existingUser }
	}
	User.findOne = (query) => {
		assert.deepEqual(query, { googleId: 'google-subject-2' })
		return { select: async () => null }
	}

	try {
		const linkedUser = await linkGoogleUser('authenticated-user-id', {
			id: 'google-subject-2',
			emails: [{ value: 'different-google@example.com', verified: true }],
			_json: { email_verified: true },
		})

		assert.equal(linkedUser, existingUser)
		assert.equal(linkedUser.googleId, 'google-subject-2')
		assert.equal(linkedUser.email, 'local-account@example.com')
		assert.equal(linkedUser.role, 'user')
		assert.equal(linkedUser.password, passwordHash)
		assert.equal(linkedUser.authProviders.email, true)
		assert.equal(linkedUser.authProviders.google, true)
		assert.equal(linkedUser.wasSaved, true)
	} finally {
		User.findById = originalFindById
		User.findOne = originalFindOne
	}
})

test('reclaims a Google identity from a passwordless Google-only account during explicit linking', async () => {
	const originalFindById = User.findById
	const originalFindOne = User.findOne
	const targetUser = {
		_id: { toString: () => 'local-user-id' },
		email: 'local@example.com',
		role: 'user',
		authProviders: { email: true, google: false },
		isActive: true,
		async save() { this.wasSaved = true },
	}
	const previousGoogleUser = {
		_id: { toString: () => 'google-only-user-id' },
		role: 'user',
		password: undefined,
		googleId: 'google-subject-3',
		authProviders: { email: false, google: true },
		isActive: true,
		company: 'Saved company',
		async save() { this.wasSaved = true },
	}

	User.findById = () => ({ select: async () => targetUser })
	User.findOne = () => ({ select: async () => previousGoogleUser })
	try {
		const linkedUser = await linkGoogleUser('local-user-id', {
			id: 'google-subject-3',
			emails: [{ value: 'google@example.com', verified: true }],
			_json: { email_verified: true },
		})

		assert.equal(linkedUser, targetUser)
		assert.equal(targetUser.googleId, 'google-subject-3')
		assert.equal(targetUser.company, 'Saved company')
		assert.equal(targetUser.role, 'user')
		assert.equal(previousGoogleUser.googleId, undefined)
		assert.equal(previousGoogleUser.isActive, false)
		assert.equal(previousGoogleUser.authProviders.google, false)
		assert.equal(previousGoogleUser.wasSaved, true)
	} finally {
		User.findById = originalFindById
		User.findOne = originalFindOne
	}
})
