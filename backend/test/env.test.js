const assert = require('node:assert/strict')
const test = require('node:test')

const envModulePath = require.resolve('../src/config/env')

test('parses SMTP_SECURE as a boolean', () => {
	const originalSmtpSecure = process.env.SMTP_SECURE

	try {
		process.env.SMTP_SECURE = ' false '
		delete require.cache[envModulePath]
		assert.equal(require(envModulePath).smtpSecure, false)

		process.env.SMTP_SECURE = ' TRUE '
		delete require.cache[envModulePath]
		assert.equal(require(envModulePath).smtpSecure, true)

		process.env.SMTP_SECURE = 'yes'
		delete require.cache[envModulePath]
		assert.throws(() => require(envModulePath), /SMTP_SECURE must be either "true" or "false"/)
	} finally {
		if (originalSmtpSecure === undefined) {
			delete process.env.SMTP_SECURE
		} else {
			process.env.SMTP_SECURE = originalSmtpSecure
		}
		delete require.cache[envModulePath]
	}
})

test('reads all SMTP settings from process.env and defaults SMTP_FROM to SMTP_USER', () => {
	const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
	const originalValues = Object.fromEntries(keys.map((key) => [key, process.env[key]]))

	try {
		Object.assign(process.env, {
			SMTP_HOST: 'mail.example.test',
			SMTP_PORT: '2465',
			SMTP_SECURE: 'true',
			SMTP_USER: 'sender@example.test',
			SMTP_PASS: 'test-only-password',
			SMTP_FROM: 'Site <sender@example.test>',
		})
		delete require.cache[envModulePath]

		let config = require(envModulePath)
		assert.equal(config.smtpHost, 'mail.example.test')
		assert.equal(config.smtpPort, 2465)
		assert.equal(config.smtpSecure, true)
		assert.equal(config.smtpUser, 'sender@example.test')
		assert.equal(config.smtpPass, 'test-only-password')
		assert.equal(config.smtpFrom, 'Site <sender@example.test>')

		process.env.SMTP_FROM = ''
		delete require.cache[envModulePath]
		config = require(envModulePath)
		assert.equal(config.smtpFrom, 'sender@example.test')

		process.env.SMTP_PORT = '587abc'
		delete require.cache[envModulePath]
		assert.throws(() => require(envModulePath), /SMTP_PORT must be an integer between 1 and 65535/)
	} finally {
		for (const key of keys) {
			if (originalValues[key] === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = originalValues[key]
			}
		}
		delete require.cache[envModulePath]
	}
})
