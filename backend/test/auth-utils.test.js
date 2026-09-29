const assert = require('node:assert/strict')
const test = require('node:test')
const {
	createVerificationToken,
	hashPassword,
	hashVerificationToken,
	verifyPassword,
} = require('../src/utils/auth.utils')

test('password hashes verify without storing the original password', async () => {
	const password = 'correct-horse-battery'
	const passwordHash = await hashPassword(password)

	assert.notEqual(passwordHash, password)
	assert.equal(await verifyPassword(password, passwordHash), true)
	assert.equal(await verifyPassword('wrong-password', passwordHash), false)
})

test('verification tokens are random and stored as a one-way hash', () => {
	const firstToken = createVerificationToken()
	const secondToken = createVerificationToken()

	assert.notEqual(firstToken.token, secondToken.token)
	assert.notEqual(firstToken.token, firstToken.tokenHash)
	assert.equal(hashVerificationToken(firstToken.token), firstToken.tokenHash)
})