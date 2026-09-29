const assert = require('node:assert/strict')
const test = require('node:test')
const requireRole = require('../src/middleware/require-role')

function runRoleGuard(user) {
	const response = {
		statusCode: 200,
		body: null,
		status(code) {
			this.statusCode = code
			return this
		},
		json(body) {
			this.body = body
			return this
		},
	}
	let nextCalled = false

	requireRole('admin')(
		{ user },
		response,
		() => { nextCalled = true },
	)

	return { ...response, nextCalled }
}

test('rejects requests without an authenticated user', () => {
	const result = runRoleGuard(undefined)

	assert.equal(result.statusCode, 401)
	assert.equal(result.body.error.message, 'Authentication required')
	assert.equal(result.nextCalled, false)
})

test('rejects authenticated users without the admin role', () => {
	const result = runRoleGuard({ id: 'user-1', role: 'user' })

	assert.equal(result.statusCode, 403)
	assert.equal(result.body.error.message, 'Insufficient permissions')
	assert.equal(result.nextCalled, false)
})

test('allows authenticated admins', () => {
	const result = runRoleGuard({ id: 'admin-1', role: 'admin' })

	assert.equal(result.statusCode, 200)
	assert.equal(result.nextCalled, true)
})