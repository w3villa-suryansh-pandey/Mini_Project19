const assert = require('node:assert/strict')
const test = require('node:test')
const User = require('../models/User')
const {
	linkFacebookUser,
	resolveFacebookUser,
} = require('../src/controllers/facebook-auth.controller')

function facebookProfile(id = 'facebook-user-1') {
	return {
		id,
		displayName: 'Facebook User',
		emails: [{ value: 'Facebook.User@example.com' }],
		photos: [{ value: 'https://example.com/photo.png' }],
	}
}

test('Facebook OAuth creates a user account from a provider email', async () => {
	const originalFindOne = User.findOne
	const originalCreate = User.create
	let createdUser
	User.findOne = () => ({ select: async () => null })
	User.create = async (fields) => {
		createdUser = fields
		return { _id: 'new-facebook-user', ...fields }
	}

	try {
		const user = await resolveFacebookUser(facebookProfile())
		assert.equal(user._id, 'new-facebook-user')
		assert.equal(createdUser.email, 'facebook.user@example.com')
		assert.equal(createdUser.facebookId, 'facebook-user-1')
		assert.equal(createdUser.authProviders.facebook, true)
		assert.equal(createdUser.role, 'user')
	} finally {
		User.findOne = originalFindOne
		User.create = originalCreate
	}
})

test('Facebook OAuth merges into an existing Google account with the same email', async () => {
	const originalFindOne = User.findOne
	let lookupCount = 0
	const existingUser = {
		_id: 'google-user',
		email: 'facebook.user@example.com',
		googleId: 'google-user-1',
		facebookId: undefined,
		authProviders: { email: false, google: true, facebook: false },
		isActive: true,
		async save() { this.saved = true },
	}
	User.findOne = () => ({
		select: async () => {
			lookupCount += 1
			return lookupCount === 1 ? null : existingUser
		},
	})

	try {
		const user = await resolveFacebookUser(facebookProfile())
		assert.equal(user, existingUser)
		assert.equal(user.googleId, 'google-user-1')
		assert.equal(user.facebookId, 'facebook-user-1')
		assert.equal(user.authProviders.google, true)
		assert.equal(user.authProviders.facebook, true)
		assert.equal(user.saved, true)
	} finally {
		User.findOne = originalFindOne
	}
})

test('an authenticated user can link an unclaimed Facebook identity', async () => {
	const originalFindById = User.findById
	const originalFindOne = User.findOne
	const user = {
		_id: { toString: () => 'authenticated-user' },
		facebookId: undefined,
		authProviders: { email: true, facebook: false },
		isActive: true,
		async save() { this.saved = true },
	}
	User.findById = () => ({ select: async () => user })
	User.findOne = () => ({ select: async () => null })

	try {
		const linkedUser = await linkFacebookUser('authenticated-user', facebookProfile('facebook-user-2'))
		assert.equal(linkedUser, user)
		assert.equal(user.facebookId, 'facebook-user-2')
		assert.equal(user.authProviders.facebook, true)
		assert.equal(user.saved, true)
	} finally {
		User.findById = originalFindById
		User.findOne = originalFindOne
	}
})