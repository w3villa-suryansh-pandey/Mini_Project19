
const { frontendUrl } = require('../config/env')

const brevoApiKey = (process.env.BREVO_API_KEY || '').trim()
const brevoSenderEmail = (process.env.BREVO_SENDER_EMAIL || '').trim()
const brevoSenderName =
    (process.env.BREVO_SENDER_NAME || 'W3Villa').trim()


const EMAIL_CONFIGURATION_MESSAGE =
    'Outgoing email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in your backend environment variables, then restart the backend.'


function isPlaceholder(value) {
    if (typeof value !== 'string') return true

    const trimmed = value.trim()

    if (!trimmed) return true

    return /^(your[-_ ]|placeholder|change.?me)/i.test(trimmed)
}

function isEmailConfigured() {
    const apiKey = brevoApiKey?.trim()
    const senderEmail = brevoSenderEmail?.trim()
    const url = frontendUrl?.trim()

    return Boolean(
        apiKey &&
        !isPlaceholder(apiKey) &&
        senderEmail &&
        !isPlaceholder(senderEmail) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail) &&
        url &&
        /^https?:\/\//i.test(url)
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
    console.log('BREVO DEBUG:', {
    rawApiKey: Boolean(process.env.BREVO_API_KEY),
    rawSender: Boolean(process.env.BREVO_SENDER_EMAIL),
    exportedApiKey: Boolean(brevoApiKey),
    exportedSender: Boolean(brevoSenderEmail),
    frontendUrl: Boolean(frontendUrl),
    configurationValid: isEmailConfigured(),
})
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
        const response = await fetch(
            'https://api.brevo.com/v3/smtp/email',
            {
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
            }
        )

        if (!response.ok) {
            const details = await response.text()
            const error = new Error(
                `Brevo API request failed with status ${response.status}`
            )

            error.code = 'BREVO_API_ERROR'
            error.responseCode = response.status

            // Log the provider's response for diagnosis, but avoid logging secrets.
            console.error('Brevo API error details:', details)

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
