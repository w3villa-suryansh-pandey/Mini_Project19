const jwt = require('jsonwebtoken')
const User = require('../../models/User')
const { authTokenSecret, nodeEnv } = require('../config/env')

async function authenticate(req, res, next) {
	if (!authTokenSecret) {
		return res.status(503).json({
			error: { message: 'Authentication is not configured on the server' },
		})
	}

	const token = req.cookies?.w3villa_session
	if (!token) {
		return res.status(401).json({ error: { message: 'Authentication required' } })
	}

	let payload
	try {
		payload = jwt.verify(token, authTokenSecret, { algorithms: ['HS256'] })
	} catch {
		return res.status(401).json({ error: { message: 'Authentication required' } })
	}

	const user = await User.findById(payload.sub)
		.select('_id name email role isActive')
		.lean()

	if (!user || !user.isActive) {
		return res.status(401).json({ error: { message: 'Authentication required' } })
	}

	req.user = user
	return next()
}

function sessionCookieOptions() {
	return {
		httpOnly: true,
		secure: nodeEnv === 'production',
		sameSite: nodeEnv === 'production' ? 'none' : 'lax',
		path: '/',
		maxAge: 7 * 24 * 60 * 60 * 1000,
	}
}

module.exports = { authenticate, sessionCookieOptions }