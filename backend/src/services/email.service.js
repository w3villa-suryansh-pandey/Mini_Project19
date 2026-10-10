
const {
    frontendUrl,
    brevoApiKey,
    brevoSenderEmail,
    brevoSenderName,
} = require('../config/env')

const EMAIL_CONFIGURATION_MESSAGE =
    'Outgoing email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in your backend environment variables, then restart the backend.'

function isPlaceholder(value) {
    return !value || /your[-_ ]|placeholder|example\.com|change.?me/i.test(value)
}

function isEmailConfigured() {
    return Boolean(
        !isPlaceholder(brevoApiKey) &&
        !isPlaceholder(brevoSenderEmail) &&
        frontendUrl
    )
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[character]))
}

async function sendVerificationEmail({ email, name, token }) {
    if (!isEmailConfigured()) {
        const error = new Error(EMAIL_CONFIGURATION_MESSAGE)
        error.status = 503
        error.code = 'EMAIL_NOT_CONFIGURED'
        throw error
    }

    const verificationUrl = new URL('/verify-email', frontendUrl)
    verificationUrl.searchParams.set('token', token)

    const safeName = escapeHtml(name)

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: {
                    name: brevoSenderName || 'W3Villa',
                    email: brevoSenderEmail,
                },
                to: [{ email, name }],
                subject: 'Verify your W3Villa email address',
                textContent:
                    `Hi ${name}, verify your email address by visiting: ${verificationUrl.href}`,
                htmlContent: `
                    <p>Hi ${safeName},</p>
                    <p>Confirm your email address to finish creating your W3Villa account.</p>
                    <p><a href="${verificationUrl.href}">Verify email address</a></p>
                    <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
                `,
            }),
        })

        if (!response.ok) {
            const details = await response.text()
            const error = new Error(
                `Brevo API request failed (${response.status}): ${details}`
            )
            error.code = 'BREVO_API_ERROR'
            error.responseCode = response.status
            throw error
        }

        const result = await response.json()
        console.log('Verification email accepted by Brevo', {
            messageId: result.messageId,
        })
    } catch (error) {
        console.error('Verification email delivery failed', {
            code: error.code || 'UNKNOWN',
            responseCode: error.responseCode,
            message: error.message,
        })
        throw error
    }
}

module.exports = {
    isEmailConfigured,
    sendVerificationEmail,
    EMAIL_CONFIGURATION_MESSAGE,
}
