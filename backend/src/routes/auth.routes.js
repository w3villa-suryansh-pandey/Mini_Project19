const express = require('express')
const passport = require('passport')
const {
	authenticate,
	getCurrentUser,
	login,
	logout,
	resendVerification,
	signUp,
	verifyEmail,
} = require('../controllers/auth.controller')
const {
	completeGoogleAuth,
	configureGoogleStrategy,
	startGoogleAuth,
	startGoogleLink,
	validateGoogleState,
} = require('../controllers/google-auth.controller')
const {
	completeFacebookAuth,
	configureFacebookStrategy,
	startFacebookAuth,
	startFacebookLink,
	validateFacebookState,
} = require('../controllers/facebook-auth.controller')

const router = express.Router()

configureGoogleStrategy(passport)
configureFacebookStrategy(passport)

function redirectToGoogle(req, res, next) {
	passport.authenticate('google', {
		scope: ['profile', 'email'],
		session: false,
		state: req.googleOAuthStateToken,
	})(req, res, next)
}

function redirectToFacebook(req, res, next) {
	passport.authenticate('facebook', {
		scope: ['email'],
		session: false,
		state: req.facebookOAuthStateToken,
	})(req, res, next)
}

router.get('/google', startGoogleAuth, redirectToGoogle)
router.get('/google/link', authenticate, startGoogleLink, redirectToGoogle)
router.get('/google/callback', validateGoogleState, (req, res, next) => {
	passport.authenticate('google', { session: false }, (error, user, info) => {
		completeGoogleAuth(error, user, info, req, res)
	})(req, res, next)
})
router.get('/facebook', startFacebookAuth, redirectToFacebook)
router.get('/facebook/link', authenticate, startFacebookLink, redirectToFacebook)
router.get('/facebook/callback', validateFacebookState, (req, res, next) => {
	passport.authenticate('facebook', { session: false }, (error, user, info) => {
		completeFacebookAuth(error, user, info, req, res)
	})(req, res, next)
})
router.post('/signup', signUp)
router.post('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', authenticate, getCurrentUser)

module.exports = router