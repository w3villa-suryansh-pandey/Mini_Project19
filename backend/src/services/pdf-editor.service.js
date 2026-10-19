const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const MAX_PDF_BYTES = 50 * 1024 * 1024
const MAX_OPERATION_BYTES = 15 * 1024 * 1024
const DOCUMENT_TTL_MS = 24 * 60 * 60 * 1000
const MAX_DOCUMENTS_PER_USER = 8
const MAX_VERSIONS = 20
const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const USER_ID_PATTERN = /^[0-9a-f]{24}$/i

const storageRoot = path.resolve(process.env.PDF_EDITOR_STORAGE_DIR || path.join(os.tmpdir(), 's19-pdf-editor'))
const workerPath = path.join(__dirname, 'pdf-editor.worker.py')
const pythonExecutable = process.env.PDF_EDITOR_PYTHON || 'python3'
const inFlightEdits = new Set()
const MAX_ACTIVE_WORKERS = 2
const MAX_QUEUED_WORKERS = 8
let activeWorkers = 0
const workerQueue = []

async function acquireWorkerSlot() {
	if (activeWorkers < MAX_ACTIVE_WORKERS) {
		activeWorkers += 1
	} else {
		if (workerQueue.length >= MAX_QUEUED_WORKERS) {
			const error = new Error('The PDF processor is busy. Try again in a moment.')
			error.status = 503
			throw error
		}
		await new Promise((resolve) => workerQueue.push(resolve))
	}
	let released = false
	return () => {
		if (released) return
		released = true
		const next = workerQueue.shift()
		if (next) next()
		else activeWorkers -= 1
	}
}

function getPaths(userId, documentId) {
	if (!USER_ID_PATTERN.test(String(userId)) || !DOCUMENT_ID_PATTERN.test(String(documentId))) {
		const error = new Error('The PDF editing session could not be found.')
		error.status = 404
		throw error
	}
	const userDirectory = path.join(storageRoot, String(userId))
	const directory = path.resolve(userDirectory, documentId)
	if (!directory.startsWith(`${userDirectory}${path.sep}`)) {
		const error = new Error('The PDF editing session could not be found.')
		error.status = 404
		throw error
	}
	return {
		userDirectory,
		directory,
		original: path.join(directory, 'original.pdf'),
		metadata: path.join(directory, 'metadata.json'),
	}
}

async function runWorker(action, inputPath, outputPath = '', operations = null) {
	const releaseWorker = await acquireWorkerSlot()
	return new Promise((resolve, reject) => {
		const child = spawn(pythonExecutable, [workerPath, action, inputPath, outputPath || '-'], {
			stdio: ['pipe', 'pipe', 'ignore'],
			env: { ...process.env, PYTHONUNBUFFERED: '1' },
		})
		let stdout = ''
		let settled = false
		const timeout = setTimeout(() => {
			child.kill('SIGKILL')
			settle(reject, Object.assign(new Error('PDF processing took too long. Try a smaller document.'), { status: 408 }))
		}, 90_000)
		const settle = (callback, value) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			releaseWorker()
			callback(value)
		}
		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString('utf8')
			if (stdout.length > 8 * 1024 * 1024) {
				child.kill('SIGKILL')
				settle(reject, Object.assign(new Error('PDF text extraction exceeded the response limit.'), { status: 413 }))
			}
		})
		child.on('error', (error) => {
			settle(reject, Object.assign(new Error(error.code === 'ENOENT'
				? 'The PDF processing service is not installed on the server.'
				: 'The PDF processing service could not start.'), { status: 503 }))
		})
		child.on('close', (code) => {
			if (settled) return
			let result
			try {
				result = JSON.parse(stdout)
			} catch {
				settle(reject, Object.assign(new Error('The PDF processing service returned an invalid response.'), { status: 502 }))
				return
			}
			if (code !== 0 || result.error) {
				settle(reject, Object.assign(new Error(result.error || 'The PDF could not be processed.'), { status: 422 }))
				return
			}
			settle(resolve, result)
		})
		child.stdin.on('error', () => undefined)
		child.stdin.end(operations ? JSON.stringify(operations) : '')
	})
}

async function readMetadata(paths, userId) {
	try {
		const metadata = JSON.parse(await fs.readFile(paths.metadata, 'utf8'))
		if (metadata.userId !== String(userId)) throw new Error('owner mismatch')
		if (Date.now() - new Date(metadata.updatedAt).getTime() > DOCUMENT_TTL_MS) {
			await fs.rm(paths.directory, { recursive: true, force: true })
			throw new Error('expired')
		}
		return metadata
	} catch {
		const error = new Error('The PDF editing session could not be found or has expired.')
		error.status = 404
		throw error
	}
}

async function writeMetadata(paths, metadata) {
	const temporary = `${paths.metadata}.${crypto.randomUUID()}.tmp`
	await fs.writeFile(temporary, JSON.stringify(metadata), { mode: 0o600 })
	await fs.rename(temporary, paths.metadata)
}

async function cleanupExpiredDocuments() {
	const now = Date.now()
	let users = []
	try { users = await fs.readdir(storageRoot, { withFileTypes: true }) } catch { return }
	for (const user of users) {
		if (!user.isDirectory() || !USER_ID_PATTERN.test(user.name)) continue
		const userDirectory = path.join(storageRoot, user.name)
		let documents = []
		try { documents = await fs.readdir(userDirectory, { withFileTypes: true }) } catch { continue }
		for (const document of documents) {
			if (!document.isDirectory() || !DOCUMENT_ID_PATTERN.test(document.name)) continue
			const directory = path.join(userDirectory, document.name)
			try {
				const metadata = JSON.parse(await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'))
				if (metadata.userId !== user.name || now - new Date(metadata.updatedAt).getTime() > DOCUMENT_TTL_MS) {
					await fs.rm(directory, { recursive: true, force: true })
				}
			} catch {
				await fs.rm(directory, { recursive: true, force: true })
			}
		}
	}
}

function safeDocumentName(value) {
	const name = path.basename(String(value || 'document.pdf'))
		.replace(/[\u0000-\u001f\u007f"\\/]/g, '')
		.trim()
	return `${(name || 'document.pdf').slice(0, 160).replace(/\.pdf$/i, '')}.pdf`
}

async function createDocument(userId, fileBuffer, name) {
	if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length < 8 || fileBuffer.length > MAX_PDF_BYTES) {
		const error = new Error('PDF files must be between 8 bytes and 50 MB.')
		error.status = 413
		throw error
	}
	if (fileBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
		const error = new Error('The uploaded file is not a valid PDF.')
		error.status = 415
		throw error
	}
	await cleanupExpiredDocuments()
	const userDirectory = path.join(storageRoot, String(userId))
	await fs.mkdir(userDirectory, { recursive: true, mode: 0o700 })
	const existing = await fs.readdir(userDirectory, { withFileTypes: true })
	if (existing.filter((entry) => entry.isDirectory() && DOCUMENT_ID_PATTERN.test(entry.name)).length >= MAX_DOCUMENTS_PER_USER) {
		const error = new Error('Close older PDF sessions before opening another document.')
		error.status = 429
		throw error
	}
	const documentId = crypto.randomUUID()
	const paths = getPaths(userId, documentId)
	await fs.mkdir(paths.directory, { recursive: true, mode: 0o700 })
	try {
		await fs.writeFile(paths.original, fileBuffer, { mode: 0o600, flag: 'wx' })
		const inspection = await runWorker('inspect', paths.original)
		const metadata = {
			documentId,
			userId: String(userId),
			name: safeDocumentName(name),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			currentVersion: 0,
			versions: [{ version: 0, createdAt: new Date().toISOString(), bytes: fileBuffer.length, original: true }],
			inspection,
		}
		await fs.copyFile(paths.original, path.join(paths.directory, 'version-0.pdf'))
		await writeMetadata(paths, metadata)
		return metadata
	} catch (error) {
		await fs.rm(paths.directory, { recursive: true, force: true })
		throw error
	}
}

async function getDocument(userId, documentId) {
	const paths = getPaths(userId, documentId)
	const metadata = await readMetadata(paths, userId)
	return { paths, metadata }
}

async function extractDocumentText(userId, documentId) {
	const { paths } = await getDocument(userId, documentId)
	return runWorker('extract', paths.original)
}

function validateOperations(operations) {
	if (!operations || typeof operations !== 'object' || Array.isArray(operations)) {
		const error = new Error('Provide valid PDF editing operations.')
		error.status = 400
		throw error
	}
	if (Buffer.byteLength(JSON.stringify(operations), 'utf8') > MAX_OPERATION_BYTES) {
		const error = new Error('The PDF editing request is too large. Reduce image size and try again.')
		error.status = 413
		throw error
	}
}

async function previewDocumentEdits(userId, documentId, operations) {
	validateOperations(operations)
	const { paths } = await getDocument(userId, documentId)
	return runWorker('preview', paths.original, '', operations)
}

async function applyDocumentEdits(userId, documentId, operations) {
	validateOperations(operations)
	const operationKey = `${userId}:${documentId}`
	if (inFlightEdits.has(operationKey)) {
		const error = new Error('A save is already processing for this PDF. Wait for it to finish.')
		error.status = 409
		throw error
	}
	inFlightEdits.add(operationKey)
	try {
		const { paths, metadata } = await getDocument(userId, documentId)
		const nextVersion = Math.max(...metadata.versions.map((item) => item.version)) + 1
		const pendingPath = path.join(paths.directory, `.pending-${crypto.randomUUID()}.pdf`)
		const targetPath = path.join(paths.directory, `version-${nextVersion}.pdf`)
		try {
			const result = await runWorker('apply', paths.original, pendingPath, operations)
			const stat = await fs.stat(pendingPath)
			if (!stat.size || stat.size > 75 * 1024 * 1024) {
				const error = new Error('The edited PDF exceeds the 75 MB export limit.')
				error.status = 413
				throw error
			}
			await fs.rename(pendingPath, targetPath)
			const updated = {
				...metadata,
				updatedAt: new Date().toISOString(),
				currentVersion: nextVersion,
				versions: [...metadata.versions, { version: nextVersion, createdAt: new Date().toISOString(), bytes: stat.size, original: false }].slice(-MAX_VERSIONS),
			}
			await writeMetadata(paths, updated)
			for (const version of metadata.versions) {
				if (!updated.versions.some((item) => item.version === version.version)) {
					await fs.rm(path.join(paths.directory, `version-${version.version}.pdf`), { force: true })
				}
			}
			return { metadata: updated, result }
		} catch (error) {
			await fs.rm(pendingPath, { force: true })
			throw error
		}
	} finally {
		inFlightEdits.delete(operationKey)
	}
}

async function restoreDocumentVersion(userId, documentId, version) {
	const { paths, metadata } = await getDocument(userId, documentId)
	const number = Number(version)
	const existing = metadata.versions.find((item) => item.version === number)
	if (!Number.isInteger(number) || !existing) {
		const error = new Error('That PDF version is not available.')
		error.status = 404
		throw error
	}
	metadata.currentVersion = number
	metadata.updatedAt = new Date().toISOString()
	await writeMetadata(paths, metadata)
	return metadata
}

async function getVersionPath(userId, documentId, version) {
	const { paths, metadata } = await getDocument(userId, documentId)
	const selectedVersion = version === undefined ? metadata.currentVersion : Number(version)
	if (!Number.isInteger(selectedVersion) || !metadata.versions.some((item) => item.version === selectedVersion)) {
		const error = new Error('That PDF version is not available.')
		error.status = 404
		throw error
	}
	return { filePath: path.join(paths.directory, `version-${selectedVersion}.pdf`), metadata, selectedVersion }
}

module.exports = {
	MAX_OPERATION_BYTES,
	MAX_PDF_BYTES,
	applyDocumentEdits,
	createDocument,
	extractDocumentText,
	getDocument,
	getVersionPath,
	previewDocumentEdits,
	restoreDocumentVersion,
	validateOperations,
}
