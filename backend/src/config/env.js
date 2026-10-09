require('dotenv').config()

const clientOrigins = (process.env.CLIENT_URLS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean)
const googleFrontendUrl = process.env.GOOGLE_FRONTEND_URL || process.env.FRONTEND_URL || 'https://mini-project19.vercel.app/'
const nodeEnv = process.env.NODE_ENV || 'development'
const allowedClientOrigins = [...new Set([
	...clientOrigins,
	process.env.FRONTEND_URL,
	googleFrontendUrl,
].filter(Boolean).map((origin) => new URL(origin).origin))]
const frontendUrl = process.env.FRONTEND_URL || (nodeEnv === 'production' ? googleFrontendUrl : clientOrigins[0] || 'http://localhost:5173')
const smtpSecure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true'

module.exports = Object.freeze({
	port: Number.parseInt(process.env.PORT, 10) || 5000,
	nodeEnv,
	clientOrigins: allowedClientOrigins,
	frontendUrl,
	googleFrontendUrl,
	googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'https://mini-project19.onrender.com/api/auth/google/callback',
	googleClientId: process.env.GOOGLE_CLIENT_ID || '',
	googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
	facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback',
	facebookClientId: process.env.FACEBOOK_CLIENT_ID || '',
	facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
	facebookFrontendUrl: process.env.FACEBOOK_FRONTEND_URL || process.env.FRONTEND_URL || 'https://mini-project19.vercel.app/',
	authTokenSecret: process.env.AUTH_TOKEN_SECRET || '',
	smtpHost: process.env.SMTP_HOST || '',
	smtpPort: Number.parseInt(process.env.SMTP_PORT, 10) || 587,
	smtpSecure,
	smtpUser: process.env.SMTP_USER || '',
	smtpPass: process.env.SMTP_PASS || '',
	smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
	razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
	razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
	razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
})