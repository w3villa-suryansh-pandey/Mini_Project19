import { useEffect, useRef, useState } from 'react'
import WebViewer from '@pdftron/webviewer'
import Sidebar from '../../components/Sidebar.jsx'
import { getUserSubscription } from '../../services/api.js'

const APRYSE_LICENSE_KEY = import.meta.env.VITE_APRYSE_LICENSE_KEY

function DocumentEditor() {
	const fileInputRef = useRef(null)
	const viewerRef = useRef(null)
	const viewerInstanceRef = useRef(null)
	const viewerPromiseRef = useRef(null)
	const viewerGenerationRef = useRef(0)
	const [documentFile, setDocumentFile] = useState(null)
	const [documentUrl, setDocumentUrl] = useState('')
	const [notice, setNotice] = useState('')
	const [isDocumentReady, setIsDocumentReady] = useState(false)
	const [isEditingText, setIsEditingText] = useState(false)
	const [viewerStatus, setViewerStatus] = useState(APRYSE_LICENSE_KEY ? 'loading' : 'missing-key')
	const [subscriptionStatus, setSubscriptionStatus] = useState('checking')
	const [subscriptionExpiry, setSubscriptionExpiry] = useState('')

	useEffect(() => {
		let isCurrent = true
		getUserSubscription({ refresh: true })
			.then(({ subscription }) => {
				if (!isCurrent) return
				setSubscriptionStatus(subscription.active ? 'active' : 'inactive')
				setSubscriptionExpiry(subscription.expiresAt || '')
			})
			.catch(() => {
				if (isCurrent) setSubscriptionStatus('unavailable')
			})

		return () => { isCurrent = false }
	}, [])

	useEffect(() => {
		if (!documentUrl) return undefined
		return () => URL.revokeObjectURL(documentUrl)
	}, [documentUrl])

	useEffect(() => {
		if (!APRYSE_LICENSE_KEY || !viewerRef.current) return undefined
		const generation = ++viewerGenerationRef.current
		const generationRef = viewerGenerationRef
		let isActive = true

		if (!viewerPromiseRef.current) {
			viewerPromiseRef.current = WebViewer({
				path: '/lib/webviewer',
				licenseKey: APRYSE_LICENSE_KEY,
				fullAPI: true,
			}, viewerRef.current)
		}

		viewerPromiseRef.current
			.then((instance) => {
				if (!isActive) return
				instance.UI.enableFeatures([instance.UI.Feature.ContentEdit])
				viewerInstanceRef.current = instance
				setViewerStatus('ready')
			})
			.catch((error) => {
				if (!isActive) return
				setNotice(error.message || 'Apryse WebViewer could not be initialized.')
				setViewerStatus('error')
			})

		return () => {
			isActive = false
			queueMicrotask(() => {
				if (generationRef.current !== generation) return
				const pendingViewer = viewerPromiseRef.current
				viewerPromiseRef.current = null
				viewerInstanceRef.current = null
				pendingViewer?.then((instance) => instance.UI.dispose()).catch(() => undefined)
			})
		}
	}, [])

	useEffect(() => {
		if (viewerStatus !== 'ready' || !documentFile || !viewerInstanceRef.current) return undefined

		const instance = viewerInstanceRef.current
		const documentViewer = instance.Core.documentViewer
		let isCurrentDocument = true
		const handleDocumentLoaded = async () => {
			if (!isCurrentDocument) return
			setIsDocumentReady(true)
			const contentEditManager = documentViewer.getContentEditManager()
			try {
				await contentEditManager.startContentEditMode()
				if (!isCurrentDocument) {
					contentEditManager.endContentEditMode()
					return
				}
				setIsEditingText(true)
				setNotice('Double-click a word to select it, then type to replace it or press Backspace to erase it.')
			} catch (error) {
				if (isCurrentDocument) {
					setNotice(error.message || 'Text editing could not be started for this PDF.')
				}
			}
		}
		documentViewer.addEventListener('documentLoaded', handleDocumentLoaded)
		instance.UI.loadDocument(documentFile, { filename: documentFile.name })

		return () => {
			isCurrentDocument = false
			documentViewer.removeEventListener('documentLoaded', handleDocumentLoaded)
		}
	}, [documentFile, viewerStatus])

	useEffect(() => {
		if (viewerStatus !== 'ready' || !viewerInstanceRef.current) return
		const exportElements = ['downloadButton', 'printButton', 'saveAsButton']
		if (subscriptionStatus === 'active') {
			viewerInstanceRef.current.UI.enableElements(exportElements)
		} else {
			viewerInstanceRef.current.UI.disableElements(exportElements)
		}
	}, [subscriptionStatus, viewerStatus])

	function openDocument(file) {
		if (!file) return
		if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			setNotice('Choose a PDF document to open.')
			return
		}

		viewerInstanceRef.current?.Core.documentViewer.getContentEditManager().endContentEditMode()
		setIsEditingText(false)
		setIsDocumentReady(false)
		setDocumentFile(file)
		setDocumentUrl(URL.createObjectURL(file))
		setNotice('')
	}

	async function toggleTextEditing() {
		const instance = viewerInstanceRef.current
		if (!instance || !documentFile || !isDocumentReady) return

		const contentEditManager = instance.Core.documentViewer.getContentEditManager()
		setNotice('')
		try {
			if (isEditingText) {
				contentEditManager.endContentEditMode()
				setIsEditingText(false)
			} else {
				await contentEditManager.startContentEditMode()
				setIsEditingText(true)
				setNotice('Double-click a word to select it, then type to replace it or press Backspace to erase it.')
			}
		} catch (error) {
			setNotice(error.message || 'PDF text editing could not be started for this document.')
			setIsEditingText(false)
		}
	}

	function handleFileChange(event) {
		openDocument(event.target.files?.[0])
		event.target.value = ''
	}

	function handleDrop(event) {
		event.preventDefault()
		openDocument(event.dataTransfer.files?.[0])
	}

	return (
		<main className="dashboard-layout">
			<Sidebar active="editor" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> Document editor</div>
					<a className="dashboard-account-link" href="/profile">
						<span className="dashboard-account-avatar" aria-hidden="true">W</span>
						<span>My account</span>
					</a>
				</header>

				<div className="document-editor-main">
					<div className="document-editor-heading">
						<div>
							<p className="dashboard-eyebrow">DOCUMENT WORKSPACE</p>
							<h1>PDF editor</h1>
						</div>
						<span className={`editor-engine-status ${viewerStatus === 'ready' ? 'connected' : ''}`}>
							<span />
							{viewerStatus === 'ready' ? 'APRYSE WEBVIEWER' : viewerStatus === 'loading' ? 'STARTING EDITOR' : viewerStatus === 'error' ? 'EDITOR UNAVAILABLE' : 'LICENSE KEY NEEDED'}
						</span>
					</div>

					<section className="document-editor-shell" aria-label="PDF editing workspace">
						<div className="document-editor-toolbar">
							<div className="editor-file-details">
								<span className="editor-file-mark" aria-hidden="true">PDF</span>
								<span className="editor-file-name">{documentFile?.name || 'No document open'}</span>
							</div>
							<div className="editor-toolbar-actions">
								<input
									ref={fileInputRef}
									className="editor-file-input"
									type="file"
									accept="application/pdf,.pdf"
									onChange={handleFileChange}
									aria-label="Choose a PDF document"
								/>
								<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()}>
									Open PDF
								</button>
								{viewerStatus === 'ready' && documentFile && (
									<button
										className="editor-open-button"
										type="button"
										onClick={toggleTextEditing}
										disabled={!isDocumentReady}
									>
										{!isDocumentReady ? 'Loading PDF…' : isEditingText ? 'Done editing' : 'Edit PDF text'}
									</button>
								)}
							</div>
						</div>

						<div className="document-editor-body" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
							{APRYSE_LICENSE_KEY && <div className="apryse-viewer-host" ref={viewerRef} />}
							{viewerStatus !== 'ready' && documentUrl && <iframe className="editor-pdf-preview" title={`Preview of ${documentFile.name}`} src={`${documentUrl}#toolbar=0&navpanes=0`} />}
							{!documentUrl && viewerStatus !== 'ready' && <div className="editor-empty-state">
									<span className="editor-empty-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M8 3.5h10l6 6v19H8zM18 3.5v7h6M12 17h8M12 21h8" /></svg></span>
									<h2>Open a document to get started</h2>
									<p>Drop a PDF here or choose one from your device.</p>
									<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()}>Choose PDF</button>
								</div>}
						</div>
					</section>
					<div className="document-editor-footer" aria-live="polite">
						<p>{notice || (viewerStatus === 'ready'
							? subscriptionStatus === 'active'
								? `Pass active until ${new Date(subscriptionExpiry).toLocaleString()}. PDF download is enabled.`
								: subscriptionStatus === 'checking'
									? 'Checking your pass. PDF downloads remain locked until access is confirmed.'
									: 'An active pass is required to download edited PDFs.'
							: viewerStatus === 'loading'
								? 'Loading Apryse WebViewer…'
								: 'Set VITE_APRYSE_LICENSE_KEY in frontend/.env.local to enable editing.')}</p>
						{subscriptionStatus !== 'active' && <a href="/pricing">View PDF plans <span aria-hidden="true">→</span></a>}
					</div>
				</div>
			</section>
		</main>
	)
}

export default DocumentEditor