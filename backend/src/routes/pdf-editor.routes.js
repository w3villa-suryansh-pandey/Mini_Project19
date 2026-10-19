const express = require('express')
const { authenticate } = require('../middleware/authenticate')
const requireRole = require('../middleware/require-role')
const {
	applyPdfEdits,
	downloadPdfVersion,
	extractPdfText,
	getPdfDocument,
	getPdfEditorAccess,
	listPdfVersions,
	previewPdfEdits,
	requireEditorFeature,
	restorePdfVersion,
	uploadPdf,
} = require('../controllers/pdf-editor.controller')

const router = express.Router()

router.use(authenticate, requireRole('user'))
router.get('/access', getPdfEditorAccess)
router.post('/documents', uploadPdf)
router.get('/documents/:documentId', getPdfDocument)
router.get('/documents/:documentId/text', requireEditorFeature, extractPdfText)
router.get('/documents/:documentId/versions', requireEditorFeature, listPdfVersions)
router.post('/documents/:documentId/preview', requireEditorFeature, previewPdfEdits)
router.post('/documents/:documentId/edits', requireEditorFeature, applyPdfEdits)
router.post('/documents/:documentId/versions/:version/restore', requireEditorFeature, restorePdfVersion)
router.get('/documents/:documentId/download', requireEditorFeature, downloadPdfVersion)

module.exports = router
