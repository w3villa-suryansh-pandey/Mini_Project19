const nodemailer = require('nodemailer')
const { frontendUrl } = require('../config/env')
const EMAIL_CONFIGURATION_MESSAGE = 'Outgoing email is not configured. Add SMTP_HOST, SMTP_FROM, and your provider credentials if required to backend/.env, then restart the backend.'

function getEmailConfig() {
	const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env
	const from = SMTP_FROM || SMTP_USER

	if (!SMTP_HOST || !from || Boolean(SMTP_USER) !== Boolean(SMTP_PASS)) {
		return null
	}

	return {
		host: SMTP_HOST,
		port: Number.parseInt(SMTP_PORT, 10) || 587,
		secure: SMTP_SECURE === 'true',
		from,
		auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
	}
}

function escapeHtml(value) {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}[character]))
}

function isEmailConfigured() {
	return Boolean(getEmailConfig())
}

async function sendVerificationEmail({ email, name, token }) {
	const config = getEmailConfig()
	if (!config) {
		const error = new Error(EMAIL_CONFIGURATION_MESSAGE)
		error.status = 503
		error.code = 'EMAIL_NOT_CONFIGURED'
		throw error
	}

	const verificationUrl = new URL('/verify-email', frontendUrl)
	verificationUrl.searchParams.set('token', token)
	const safeName = escapeHtml(name)
	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: config.auth,
	})

	await transporter.sendMail({
		from: config.from,
		to: email,
		subject: 'Verify your W3Villa email address',
		text: `Hi ${name}, verify your email address by visiting: ${verificationUrl.href}`,
		html: `<p>Hi ${safeName},</p><p>Confirm your email address to finish creating your W3Villa account.</p><p><a href="${verificationUrl.href}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
	})
}

module.exports = { isEmailConfigured, sendVerificationEmail, EMAIL_CONFIGURATION_MESSAGE }