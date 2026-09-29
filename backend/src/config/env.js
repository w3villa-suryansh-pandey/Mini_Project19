require('dotenv').config()

const clientOrigins = (process.env.CLIENT_URLS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean)

module.exports = Object.freeze({
	port: Number.parseInt(process.env.PORT, 10) || 5000,
	nodeEnv: process.env.NODE_ENV || 'development',
	clientOrigins,
	frontendUrl: process.env.FRONTEND_URL || clientOrigins[0],
	googleFrontendUrl: process.env.GOOGLE_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5175',
	googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
	googleClientId: process.env.GOOGLE_CLIENT_ID || '',
	googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
	facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback',
	facebookClientId: process.env.FACEBOOK_CLIENT_ID || '',
	facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
	facebookFrontendUrl: process.env.FACEBOOK_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5176',
	authTokenSecret: process.env.AUTH_TOKEN_SECRET || '',
	stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
	stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
})