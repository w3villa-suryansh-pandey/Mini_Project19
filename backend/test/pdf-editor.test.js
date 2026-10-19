const assert = require('node:assert/strict')
const test = require('node:test')
const { getDocument, validateOperations, MAX_OPERATION_BYTES } = require('../src/services/pdf-editor.service')

test('PDF editor requests must be JSON objects within the processing limit', () => {
	assert.throws(() => validateOperations(null), /valid PDF editing operations/)
	assert.throws(() => validateOperations([]), /valid PDF editing operations/)
	assert.throws(() => validateOperations({ data: 'x'.repeat(MAX_OPERATION_BYTES) }), /too large/)
	assert.doesNotThrow(() => validateOperations({ edits: [], addedTexts: [], annotations: [] }))
})

test('PDF document IDs and owners are validated before a filesystem lookup', async () => {
	await assert.rejects(getDocument('../another-user', 'not-a-uuid'), { status: 404 })
	await assert.rejects(getDocument('507f1f77bcf86cd799439011', '../outside'), { status: 404 })
})
