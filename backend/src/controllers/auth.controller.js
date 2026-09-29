const jwt = require('jsonwebtoken')
const User = require('../../models/User')
const { authTokenSecret } = require('../config/env')
const { authenticate, sessionCookieOptions } = require('../middleware/authenticate')
const {
	hashPassword,
	hashVerificationToken,
	verifyPassword,
} = require('../utils/auth.utils')

const SESSION_WINDOW = '7d'

function respondWithError(res, status, code, message) {
	return res.status(status).json({ error: { code, message } })
}

function publicUser(user) {
	return {
		id: user._id.toString(),
		name: user.name,
		email: user.email,
		role: user.role,
	}
}

function validateCredentials({ name, email, password }, requireName) {
	if (requireName && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
		return 'Enter your name (up to 100 characters).'
	}
	if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
		return 'Enter a valid email address.'
	}
	if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
		return 'Password must be between 8 and 72 characters.'
	}
	return null
}

function authConfigurationError(res) {
	return respondWithError(
		res,
		503,
		'AUTH_NOT_CONFIGURED',
		'Authentication is not configured. Set AUTH_TOKEN_SECRET to a random secret of at least 32 characters.',
	)
}

async function signUp(req, res) {
	const { name, email, password, role = 'user' } = req.body || {}
	const validationError = validateCredentials({ name, email, password }, true)
	if (validationError) {
		return respondWithError(res, 400, 'INVALID_INPUT', validationError)
	}
	if (role === 'admin') {
		return respondWithError(res, 403, 'ADMIN_SIGNUP_DISABLED', 'Admin accounts can only be created by an existing admin.')
	}
	if (role !== 'user') {
		return respondWithError(res, 400, 'INVALID_ROLE', 'Choose a valid account type.')
	}
	if (!authTokenSecret || authTokenSecret.length < 32) {
		return authConfigurationError(res)
	}

	const normalizedEmail = email.trim().toLowerCase()
	const existingUser = await User.findOne({ email: normalizedEmail }).select('_id')
	if (existingUser) {
		return respondWithError(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.')
	}

	let user
	try {
		user = await User.create({
			name: name.trim(),
			email: normalizedEmail,
			password: await hashPassword(password),
			emailVerifiedAt: new Date(),
			role: 'user',
			authProviders: { email: true },
		})
	} catch (error) {
		if (error.code === 11000) {
			return respondWithError(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.')
		}
		throw error
	}

	const sessionToken = jwt.sign({ sub: user._id.toString() }, authTokenSecret, {
		algorithm: 'HS256',
		expiresIn: SESSION_WINDOW,
	})
	res.cookie('w3villa_session', sessionToken, sessionCookieOptions())
	return res.status(201).json({
		message: 'Account created and signed in.',
		user: publicUser(user),
	})
}

async function verifyEmail(req, res) {
	const token = req.body?.token
	if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
		return respondWithError(res, 400, 'INVALID_TOKEN', 'This verification link is invalid or expired.')
	}

	const user = await User.findOneAndUpdate(
		{
			emailVerificationTokenHash: hashVerificationToken(token),
			emailVerificationExpiresAt: { $gt: new Date() },
		},
		{
			$set: { emailVerifiedAt: new Date() },
			$unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
		},
		{ new: true },
	)
	if (!user) {
		return respondWithError(res, 400, 'INVALID_TOKEN', 'This verification link is invalid or expired.')
	}

	return res.json({ message: 'Email verified. You can now sign in.' })
}

async function resendVerification(req, res) {
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
	if (!/^\S+@\S+\.\S+$/.test(email)) {
		return respondWithError(res, 400, 'INVALID_EMAIL', 'Enter a valid email address.')
	}
	return res.json({ message: 'Email verification is temporarily disabled. You can sign in without verification.' })
}

async function login(req, res) {
	const { email, password, role = 'user' } = req.body || {}
	if (typeof email !== 'string' || typeof password !== 'string') {
		return respondWithError(res, 400, 'INVALID_INPUT', 'Enter your email and password.')
	}
	if (!['user', 'admin'].includes(role)) {
		return respondWithError(res, 400, 'INVALID_ROLE', 'Choose a valid account type.')
	}
	if (!authTokenSecret || authTokenSecret.length < 32) {
		return authConfigurationError(res)
	}

	const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')
	if (!user || !user.password || !(await verifyPassword(password, user.password))) {
		return respondWithError(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
	}
	if (!user.isActive) {
		return respondWithError(res, 403, 'ACCOUNT_DISABLED', 'This account is disabled.')
	}
	if (user.role !== role) {
		return respondWithError(res, 403, 'ROLE_MISMATCH', `This account is registered as ${user.role}. Choose that account type to sign in.`)
	}

	const sessionToken = jwt.sign({ sub: user._id.toString() }, authTokenSecret, {
		algorithm: 'HS256',
		expiresIn: SESSION_WINDOW,
	})
	res.cookie('w3villa_session', sessionToken, sessionCookieOptions())
	return res.json({ user: publicUser(user) })
}

function logout(req, res) {
	const options = sessionCookieOptions()
	delete options.maxAge
	res.clearCookie('w3villa_session', options)
	return res.json({ message: 'Signed out.' })
}

function getCurrentUser(req, res) {
	return res.json({ user: publicUser(req.user) })
}

module.exports = {
	signUp,
	verifyEmail,
	resendVerification,
	login,
	logout,
	getCurrentUser,
	authenticate,
}