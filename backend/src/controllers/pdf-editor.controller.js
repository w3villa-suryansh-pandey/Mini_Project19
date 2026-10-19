const fs = require('node:fs')
const path = require('node:path')
const {
	applyDocumentEdits,
	createDocument,
	extractDocumentText,
	getDocument,
	getVersionPath,
	previewDocumentEdits,
	restoreDocumentVersion,
} = require('../services/pdf-editor.service')
const { findActiveSubscription, subscriptionDetails } = require('../services/subscription.service')

function respondWithError(res, status, message, code) {
	return res.status(status).json({ error: { message, ...(code ? { code } : {}) } })
}

async function requireEditorFeature(req, res, next) {
	const subscription = await findActiveSubscription(req.user._id)
	if (!subscriptionDetails(subscription).featureKeys.includes('pdf_editor')) {
		return respondWithError(res, 403, 'An active plan with PDF editing access is required.', 'PDF_EDITOR_PLAN_REQUIRED')
	}
	return next()
}

async function uploadPdf(req, res) {
	const metadata = await createDocument(req.user._id, req.body, req.query.name)
	return res.status(201).json({
		document: {
			id: metadata.documentId,
			name: metadata.name,
			createdAt: metadata.createdAt,
			updatedAt: metadata.updatedAt,
			currentVersion: metadata.currentVersion,
			versions: metadata.versions,
			...metadata.inspection,
		},
	})
}

async function getPdfDocument(req, res) {
	const { metadata } = await getDocument(req.user._id, req.params.documentId)
	return res.json({
		document: {
			id: metadata.documentId,
			name: metadata.name,
			createdAt: metadata.createdAt,
			updatedAt: metadata.updatedAt,
			currentVersion: metadata.currentVersion,
			versions: metadata.versions,
			...metadata.inspection,
		},
	})
}

async function extractPdfText(req, res) {
	const result = await extractDocumentText(req.user._id, req.params.documentId)
	return res.json(result)
}

async function previewPdfEdits(req, res) {
	const result = await previewDocumentEdits(req.user._id, req.params.documentId, req.body)
	if (result.warnings.length && req.body.confirmOverlap !== true) {
		return res.status(409).json({
			error: { code: 'PDF_EDIT_OVERLAP', message: 'The selected redaction area overlaps nearby page content.' },
			warnings: result.warnings,
		})
	}
	return res.json({ warnings: result.warnings })
}

async function applyPdfEdits(req, res) {
	const result = await applyDocumentEdits(req.user._id, req.params.documentId, req.body)
	return res.json({
		document: {
			id: result.metadata.documentId,
			name: result.metadata.name,
			currentVersion: result.metadata.currentVersion,
			versions: result.metadata.versions,
			...result.result,
		},
	})
}

async function listPdfVersions(req, res) {
	const { metadata } = await getDocument(req.user._id, req.params.documentId)
	return res.json({
		versions: metadata.versions.map((version) => ({
			...version,
			isCurrent: version.version === metadata.currentVersion,
		})),
	})
}

async function restorePdfVersion(req, res) {
	const metadata = await restoreDocumentVersion(req.user._id, req.params.documentId, req.params.version)
	return res.json({ document: { id: metadata.documentId, currentVersion: metadata.currentVersion } })
}

async function downloadPdfVersion(req, res) {
	const { filePath, metadata, selectedVersion } = await getVersionPath(
		req.user._id,
		req.params.documentId,
		req.query.version,
	)
	const baseName = path.basename(metadata.name, '.pdf').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'document'
	res.set({
		'Content-Type': 'application/pdf',
		'Content-Disposition': `attachment; filename="${baseName}-v${selectedVersion}.pdf"`,
		'Cache-Control': 'private, no-store',
	})
	const stream = fs.createReadStream(filePath)
	stream.on('error', () => {
		if (!res.headersSent) respondWithError(res, 404, 'The requested PDF version is unavailable.')
		else res.destroy()
	})
	stream.pipe(res)
}

async function getPdfEditorAccess(req, res) {
	const subscription = await findActiveSubscription(req.user._id)
	const details = subscriptionDetails(subscription)
	return res.json({
		canExport: details.featureKeys.includes('pdf_editor'),
		planId: details.planId,
	})
}

module.exports = {
	applyPdfEdits,
	downloadPdfVersion,
	extractPdfText,
	getPdfDocument,
	getPdfEditorAccess,
	listPdfVersions,
	previewPdfEdits,
	restorePdfVersion,
	uploadPdf,
	requireEditorFeature,
}
