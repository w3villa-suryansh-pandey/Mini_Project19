const nodemailer = require('nodemailer')
const {
	frontendUrl,
	smtpHost,
	smtpPort,
	smtpSecure,
	smtpUser,
	smtpPass,
	smtpFrom,
} = require('../config/env')
const EMAIL_CONFIGURATION_MESSAGE = 'Outgoing email is not configured. Set SMTP_HOST and SMTP_FROM in backend/.env, use valid SMTP_USER and SMTP_PASS credentials (a Gmail app password if using Gmail), then restart the backend.'

function isPlaceholder(value) {
	return /your[-_ ]|placeholder|example\.com|change.?me/i.test(value)
}

function getEmailConfig() {
	const from = smtpFrom || smtpUser

	if (
		!smtpHost
		|| !from
		|| Boolean(smtpUser) !== Boolean(smtpPass)
		|| isPlaceholder(smtpUser)
		|| isPlaceholder(smtpPass)
		|| isPlaceholder(from)
	) {
		return null
	}

	return {
		host: smtpHost,
		port: smtpPort,
		secure: smtpSecure,
		from,
		auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
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

	try {
		await transporter.sendMail({
			from: config.from,
			to: email,
			subject: 'Verify your S19 email address',
			text: `Hi ${name}, verify your email address by visiting: ${verificationUrl.href}`,
			html: `<p>Hi ${safeName},</p><p>Confirm your email address to finish creating your S19 account.</p><p><a href="${verificationUrl.href}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
		})
	} catch (error) {
		console.error('Verification email delivery failed', {
			code: error.code || 'UNKNOWN',
			command: error.command || 'UNKNOWN',
			responseCode: Number.isInteger(error.responseCode) ? error.responseCode : undefined,
		})
		throw error
	}
}

module.exports = { isEmailConfigured, sendVerificationEmail, EMAIL_CONFIGURATION_MESSAGE }