const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')

async function hashPassword(password) {
	return bcrypt.hash(password, 12)
}

async function verifyPassword(password, passwordHash) {
	return bcrypt.compare(password, passwordHash)
}

function createVerificationToken() {
	const token = crypto.randomBytes(32).toString('base64url')
	const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
	return { token, tokenHash }
}

function hashVerificationToken(token) {
	return crypto.createHash('sha256').update(token).digest('hex')
}

module.exports = {
	hashPassword,
	verifyPassword,
	createVerificationToken,
	hashVerificationToken,
}