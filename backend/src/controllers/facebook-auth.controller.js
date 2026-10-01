const jwt = require('jsonwebtoken')
const FacebookStrategy = require('passport-facebook').Strategy
const User = require('../../models/User')
const {
	authTokenSecret,
	facebookCallbackUrl,
	facebookClientId,
	facebookClientSecret,
	facebookFrontendUrl,
	nodeEnv,
} = require('../config/env')
const { sessionCookieOptions } = require('../middleware/authenticate')

const FACEBOOK_STATE_COOKIE = 'w3villa_facebook_oauth_state'
const SESSION_WINDOW = '7d'

function facebookAuthError(code, message) {
	const error = new Error(message)
	error.facebookAuthCode = code
	return error
}

function getFacebookEmail(profile) {
	const email = profile.emails?.find((item) => item.value)?.value || profile._json?.email
	if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
		throw facebookAuthError('facebook_email_missing', 'Facebook did not provide an email. Allow email access in Facebook and try again.')
	}
	return email.trim().toLowerCase()
}

async function resolveFacebookUser(profile) {
	let user = await User.findOne({ facebookId: profile.id })
		.select('_id name email role googleId facebookId emailVerifiedAt authProviders isActive')
	if (user) {
		if (!user.isActive) throw facebookAuthError('facebook_account_disabled', 'This account is disabled.')
		user.authProviders = { ...user.authProviders?.toObject?.(), ...user.authProviders, facebook: true }
		await user.save()
		return user
	}

	const email = getFacebookEmail(profile)
	user = await User.findOne({ email })
		.select('_id name email role googleId facebookId emailVerifiedAt authProviders isActive')
	if (user) {
		if (!user.isActive) throw facebookAuthError('facebook_account_disabled', 'This account is disabled.')
		if (user.facebookId && user.facebookId !== profile.id) {
			throw facebookAuthError('facebook_account_linked_elsewhere', 'This account already has a different Facebook account linked.')
		}
		user.facebookId = profile.id
		user.authProviders = { ...user.authProviders?.toObject?.(), ...user.authProviders, facebook: true }
		await user.save()
		return user
	}

	return User.create({
		name: profile.displayName?.trim() || email.split('@')[0],
		email,
		role: 'user',
		facebookId: profile.id,
		profilePicture: profile.photos?.[0]?.value || '',
		authProviders: { facebook: true },
	})
}

async function linkFacebookUser(userId, profile) {
	const user = await User.findById(userId)
		.select('_id name email role facebookId authProviders isActive')
	if (!user || !user.isActive) {
		throw facebookAuthError('facebook_link_account_unavailable', 'The account being linked is unavailable.')
	}
	if (user.facebookId && user.facebookId !== profile.id) {
		throw facebookAuthError('facebook_account_linked_elsewhere', 'This account already has a different Facebook account linked.')
	}

	const existingLink = await User.findOne({ facebookId: profile.id })
		.select('_id role facebookId authProviders isActive')
	if (existingLink && existingLink._id.toString() !== user._id.toString()) {
		throw facebookAuthError('facebook_account_linked_elsewhere', 'This Facebook account is linked to another account.')
	}

	user.facebookId = profile.id
	user.authProviders = { ...user.authProviders?.toObject?.(), ...user.authProviders, facebook: true }
	await user.save()
	return user
}

function configureFacebookStrategy(passport) {
	if (!facebookClientId || !facebookClientSecret) return false

	passport.use('facebook', new FacebookStrategy({
		clientID: facebookClientId,
		clientSecret: facebookClientSecret,
		callbackURL: facebookCallbackUrl,
		profileFields: ['id', 'displayName', 'emails', 'photos'],
		passReqToCallback: true,
	}, async (req, accessToken, refreshToken, profile, done) => {
		try {
			const user = req.facebookOAuthState?.linkUserId
				? await linkFacebookUser(req.facebookOAuthState.linkUserId, profile)
				: await resolveFacebookUser(profile)
			return done(null, user)
		} catch (error) {
			if (error.facebookAuthCode) return done(null, false, { code: error.facebookAuthCode })
			return done(error)
		}
	}))

	return true
}

function facebookStateCookieOptions() {
	return {
		httpOnly: true,
		secure: nodeEnv === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 10 * 60 * 1000,
	}
}

function redirectWithError(res, code) {
	const target = new URL('/', facebookFrontendUrl)
	target.searchParams.set('authError', code)
	return res.redirect(target.toString())
}

function prepareFacebookAuth(req, res, next, linkUserId) {
	if (!facebookClientId || !facebookClientSecret) return redirectWithError(res, 'facebook_not_configured')
	if (!authTokenSecret || authTokenSecret.length < 32) return redirectWithError(res, 'auth_not_configured')

	const state = jwt.sign({
		purpose: 'facebook_oauth',
		nonce: require('node:crypto').randomBytes(16).toString('hex'),
		...(linkUserId ? { linkUserId: linkUserId.toString() } : {}),
	}, authTokenSecret, { algorithm: 'HS256', expiresIn: '10m' })
	res.cookie(FACEBOOK_STATE_COOKIE, state, facebookStateCookieOptions())
	req.facebookOAuthStateToken = state
	return next()
}

function startFacebookAuth(req, res, next) {
	return prepareFacebookAuth(req, res, next)
}

function startFacebookLink(req, res, next) {
	return prepareFacebookAuth(req, res, next, req.user._id)
}

function validateFacebookState(req, res, next) {
	res.clearCookie(FACEBOOK_STATE_COOKIE, { ...facebookStateCookieOptions(), maxAge: undefined })
	if (req.query.error) {
		return redirectWithError(res, req.query.error === 'access_denied' ? 'facebook_login_cancelled' : 'facebook_provider_error')
	}

	const state = req.query.state
	const cookieState = req.cookies?.[FACEBOOK_STATE_COOKIE]
	if (typeof state !== 'string' || !cookieState) return redirectWithError(res, 'facebook_state_missing')
	if (state !== cookieState) return redirectWithError(res, 'facebook_state_mismatch')

	try {
		const payload = jwt.verify(state, authTokenSecret, { algorithms: ['HS256'] })
		if (payload.purpose !== 'facebook_oauth') return redirectWithError(res, 'facebook_state_invalid')
		req.facebookOAuthState = payload
	} catch (error) {
		return redirectWithError(res, error.name === 'TokenExpiredError' ? 'facebook_state_expired' : 'facebook_state_invalid')
	}
	return next()
}

function completeFacebookAuth(error, user, info, req, res) {
	if (error) {
		console.error('Facebook OAuth callback failed:', error.name, error.code || '', error.message)
		return redirectWithError(res, 'facebook_provider_error')
	}
	if (!user) return redirectWithError(res, info?.code || 'facebook_auth_failed')

	const sessionToken = jwt.sign({ sub: user._id.toString() }, authTokenSecret, {
		algorithm: 'HS256',
		expiresIn: SESSION_WINDOW,
	})
	res.cookie('w3villa_session', sessionToken, sessionCookieOptions())
	if (req.facebookOAuthState?.linkUserId) {
		if (req.facebookOAuthState.linkUserId !== user._id.toString()) {
			return redirectWithError(res, 'facebook_link_account_mismatch')
		}
		return res.redirect(new URL('/profile?facebookLinked=true', facebookFrontendUrl).toString())
	}
	return res.redirect(new URL(user.role === 'admin' ? '/admin' : '/dashboard', facebookFrontendUrl).toString())
}

module.exports = {
	completeFacebookAuth,
	configureFacebookStrategy,
	getFacebookEmail,
	linkFacebookUser,
	resolveFacebookUser,
	startFacebookAuth,
	startFacebookLink,
	validateFacebookState,
}