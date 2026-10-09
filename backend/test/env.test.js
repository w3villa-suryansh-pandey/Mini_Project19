const assert = require('node:assert/strict')
const test = require('node:test')

const envModulePath = require.resolve('../src/config/env')

test('parses SMTP_SECURE as a boolean', () => {
	const originalSmtpSecure = process.env.SMTP_SECURE

	try {
		process.env.SMTP_SECURE = 'false'
		delete require.cache[envModulePath]
		assert.equal(require(envModulePath).smtpSecure, false)

		process.env.SMTP_SECURE = 'true'
		delete require.cache[envModulePath]
		assert.equal(require(envModulePath).smtpSecure, true)
	} finally {
		if (originalSmtpSecure === undefined) {
			delete process.env.SMTP_SECURE
		} else {
			process.env.SMTP_SECURE = originalSmtpSecure
		}
		delete require.cache[envModulePath]
	}
})
