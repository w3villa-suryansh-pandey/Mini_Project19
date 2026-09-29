const crypto = require('node:crypto')
const jwt = require('jsonwebtoken')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require('../../models/User')
const {
	authTokenSecret,
	frontendUrl,
	googleCallbackUrl,
	googleClientId,
	googleClientSecret,
	googleFrontendUrl,
	nodeEnv,
} = require('../config/env')
const { sessionCookieOptions } = require('../middleware/authenticate')

const GOOGLE_STATE_COOKIE = 'w3villa_google_oauth_state'
const SESSION_WINDOW = '7d'

function googleAuthError(code, message) {
	const error = new Error(message)
	error.googleAuthCode = code
	return error
}

function getVerifiedGoogleIdentity(profile) {
	const emailRecord = profile.emails?.find((item) => item.value)
	const email = emailRecord?.value?.trim().toLowerCase()
	const emailVerified = profile._json?.email_verified === true || emailRecord?.verified === true
	if (!email || !emailVerified) {
		throw googleAuthError('google_email_unverified', 'Google did not provide a verified email address.')
	}
	return { email, name: profile.displayName?.trim() || email.split('@')[0] }
}

async function resolveGoogleUser(profile) {
	const { email, name } = getVerifiedGoogleIdentity(profile)

	let user = await User.findOne({
		$or: [{ googleId: profile.id }, { email }],
	}).select('_id name email role googleId emailVerifiedAt authProviders isActive')

	if (user) {
		if (user.googleId && user.googleId !== profile.id) {
			throw googleAuthError('google_account_linked_elsewhere', 'This account is linked to another Google account.')
		}
		if (!user.isActive) {
			throw googleAuthError('google_account_disabled', 'This account is disabled.')
		}

		user.googleId = profile.id
		user.authProviders = { ...user.authProviders?.toObject?.(), ...user.authProviders, google: true }
		user.emailVerifiedAt ||= new Date()
		await user.save()
		return user
	}

	return User.create({
		name,
		email,
		googleId: profile.id,
		emailVerifiedAt: new Date(),
		authProviders: { google: true },
	})
}

async function linkGoogleUser(userId, profile) {
	getVerifiedGoogleIdentity(profile)
	const user = await User.findById(userId)
		.select('_id name email role googleId authProviders isActive')
	if (!user || !user.isActive) {
		throw googleAuthError('google_link_account_unavailable', 'The account being linked is unavailable.')
	}
	if (user.googleId && user.googleId !== profile.id) {
		throw googleAuthError('google_account_linked_elsewhere', 'This account already has a different Google account linked.')
	}

	const linkedAccount = await User.findOne({ googleId: profile.id })
		.select('_id role googleId authProviders isActive phone company jobTitle bio profilePicture +password')
	if (linkedAccount && linkedAccount._id.toString() !== user._id.toString()) {
		const isGoogleOnlyAccount = !linkedAccount.password
			&& linkedAccount.role === 'user'
			&& linkedAccount.authProviders?.google
			&& !linkedAccount.authProviders?.email
		if (!isGoogleOnlyAccount) {
			throw googleAuthError('google_account_linked_elsewhere', 'This Google account is linked to another account.')
		}

		for (const field of ['phone', 'company', 'jobTitle', 'bio', 'profilePicture']) {
			if (!user[field] && linkedAccount[field]) user[field] = linkedAccount[field]
		}
		linkedAccount.googleId = undefined
		linkedAccount.authProviders = { ...linkedAccount.authProviders?.toObject?.(), ...linkedAccount.authProviders, google: false }
		linkedAccount.isActive = false
		await linkedAccount.save()
	}

	user.googleId = profile.id
	user.authProviders = { ...user.authProviders?.toObject?.(), ...user.authProviders, google: true }
	await user.save()
	return user
}

function googleStateCookieOptions() {
	return {
		httpOnly: true,
		secure: nodeEnv === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 10 * 60 * 1000,
	}
}

function redirectWithError(res, code) {
	const target = new URL('/', googleFrontendUrl || frontendUrl)
	target.searchParams.set('authError', code)
	return res.redirect(target.toString())
}

function configureGoogleStrategy(passport) {
	if (!googleClientId || !googleClientSecret) return false

	passport.use('google', new GoogleStrategy({
		clientID: googleClientId,
		clientSecret: googleClientSecret,
		callbackURL: googleCallbackUrl,
		passReqToCallback: true,
	}, async (req, accessToken, refreshToken, profile, done) => {
		try {
			const user = req.googleOAuthState?.linkUserId
				? await linkGoogleUser(req.googleOAuthState.linkUserId, profile)
				: await resolveGoogleUser(profile)
			return done(null, user)
		} catch (error) {
			if (error.googleAuthCode) {
				return done(null, false, { code: error.googleAuthCode })
			}
			return done(error)
		}
	}))

	return true
}

function prepareGoogleAuth(req, res, next, linkUserId) {
	if (!googleClientId || !googleClientSecret) {
		return redirectWithError(res, 'google_not_configured')
	}
	if (!authTokenSecret || authTokenSecret.length < 32) {
		return redirectWithError(res, 'auth_not_configured')
	}

	const state = jwt.sign({
		purpose: 'google_oauth',
		nonce: crypto.randomBytes(16).toString('hex'),
		...(linkUserId ? { linkUserId: linkUserId.toString() } : {}),
	}, authTokenSecret, { algorithm: 'HS256', expiresIn: '10m' })
	res.cookie(GOOGLE_STATE_COOKIE, state, googleStateCookieOptions())
	req.googleOAuthStateToken = state
	return next()
}

function startGoogleAuth(req, res, next) {
	return prepareGoogleAuth(req, res, next)
}

function startGoogleLink(req, res, next) {
	return prepareGoogleAuth(req, res, next, req.user._id)
}

function validateGoogleState(req, res, next) {
	res.clearCookie(GOOGLE_STATE_COOKIE, { ...googleStateCookieOptions(), maxAge: undefined })
	if (req.query.error) {
		return redirectWithError(res, req.query.error === 'access_denied' ? 'google_login_cancelled' : 'google_provider_error')
	}

	const state = req.query.state
	const cookieState = req.cookies?.[GOOGLE_STATE_COOKIE]
	if (typeof state !== 'string' || !cookieState) {
		return redirectWithError(res, 'google_state_missing')
	}
	if (state !== cookieState) {
		return redirectWithError(res, 'google_state_mismatch')
	}

	try {
		const payload = jwt.verify(state, authTokenSecret, { algorithms: ['HS256'] })
		if (payload.purpose !== 'google_oauth') return redirectWithError(res, 'google_state_invalid')
		req.googleOAuthState = payload
	} catch (error) {
		return redirectWithError(res, error.name === 'TokenExpiredError' ? 'google_state_expired' : 'google_state_invalid')
	}

	return next()
}

function completeGoogleAuth(error, user, info, req, res) {
	if (error) {
		console.error('Google OAuth callback failed:', error.name, error.code || '', error.message)
		return redirectWithError(res, 'google_provider_error')
	}
	if (!user) return redirectWithError(res, info?.code || 'google_auth_failed')

	const sessionToken = jwt.sign({ sub: user._id.toString() }, authTokenSecret, {
		algorithm: 'HS256',
		expiresIn: SESSION_WINDOW,
	})
	res.cookie('w3villa_session', sessionToken, sessionCookieOptions())
	if (req.googleOAuthState?.linkUserId) {
		if (req.googleOAuthState.linkUserId !== user._id.toString()) {
			return redirectWithError(res, 'google_link_account_mismatch')
		}
		return res.redirect(new URL('/profile?googleLinked=true', googleFrontendUrl || frontendUrl).toString())
	}
	const destination = user.role === 'admin' ? '/admin' : '/dashboard'
	return res.redirect(new URL(destination, googleFrontendUrl || frontendUrl).toString())
}

module.exports = {
	configureGoogleStrategy,
	linkGoogleUser,
	resolveGoogleUser,
	startGoogleLink,
	startGoogleAuth,
	validateGoogleState,
	completeGoogleAuth,
}
