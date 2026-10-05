import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import { getUserSubscription } from '../../services/api.js'

const PAGE_SCALE = 1.35
const MAX_FILE_SIZE = 50 * 1024 * 1024

let pdfjsLibraryPromise

function loadPdfJs() {
	if (!pdfjsLibraryPromise) {
		pdfjsLibraryPromise = import('pdfjs-dist').then((library) => {
			library.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
			return library
		}).catch((error) => {
			pdfjsLibraryPromise = null
			throw error
		})
	}
	return pdfjsLibraryPromise
}

function fontNameForFamily(fontFamily, StandardFonts) {
	const name = fontFamily.toLowerCase()
	const italic = name.includes('italic') || name.includes('oblique')
	const weight = name.includes('bold') ? 'Bold' : ''
	let family

	if (/courier|mono/.test(name)) {
		family = 'Courier'
	} else if (/times|serif/.test(name)) {
		family = 'Times'
	} else {
		family = 'Helvetica'
	}

	if (family === 'Times') {
		if (weight && italic) return StandardFonts.TimesRomanBoldItalic
		if (weight) return StandardFonts.TimesRomanBold
		if (italic) return StandardFonts.TimesRomanItalic
		return StandardFonts.TimesRoman
	}
	if (weight && italic) return StandardFonts[`${family}BoldOblique`]
	if (weight) return StandardFonts[`${family}Bold`]
	if (italic) return StandardFonts[`${family}Oblique`]
	return StandardFonts[family]
}

function parseColor(color, rgb) {
	const values = color.match(/[\d.]+/g)?.map(Number)
	if (!values || values.length < 3) return rgb(0, 0, 0)
	return rgb(values[0] / 255, values[1] / 255, values[2] / 255)
}

function PdfPage({ document, pdfjsLibrary, pageNumber, editsEnabled, onTextEdit }) {
	const pageRef = useRef(null)
	const canvasRef = useRef(null)
	const textLayerRef = useRef(null)
	const [pageError, setPageError] = useState('')

	useEffect(() => {
		let isCurrent = true
		let textLayer
		let renderTask
		let cleanupTextEvents
		const pageElement = pageRef.current

		async function renderPage() {
			const page = await document.getPage(pageNumber)
			if (!isCurrent) return

			const viewport = page.getViewport({ scale: PAGE_SCALE })
			const canvas = canvasRef.current
			const context = canvas.getContext('2d', { alpha: false })
			const outputScale = window.devicePixelRatio || 1
			canvas.width = Math.floor(viewport.width * outputScale)
			canvas.height = Math.floor(viewport.height * outputScale)
			canvas.style.width = `${viewport.width}px`
			canvas.style.height = `${viewport.height}px`
			pageElement.style.width = `${viewport.width}px`
			pageElement.style.height = `${viewport.height}px`

			renderTask = page.render({
				canvasContext: context,
				viewport,
				transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
			})
			await renderTask.promise
			if (!isCurrent) return

			const textContent = await page.getTextContent()
			textLayer = new pdfjsLibrary.TextLayer({
				textContentSource: textContent,
				container: textLayerRef.current,
				viewport,
			})
			await textLayer.render()
			if (!isCurrent) return

			textLayer.textDivs.forEach((textDiv, itemIndex) => {
				const text = textLayer.textContentItemsStr[itemIndex]
				if (!text?.trim()) return

				textDiv.dataset.pdfTextIndex = String(itemIndex)
				textDiv.setAttribute('role', 'textbox')
				textDiv.setAttribute('aria-label', `PDF text: ${text}`)
				textDiv.setAttribute('aria-multiline', 'true')
				textDiv.contentEditable = editsEnabled ? 'true' : 'false'
				textDiv.spellcheck = false
			})

			const handleFocus = (event) => {
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv || !pageElement) return
				if (!textDiv.dataset.pdfPatch) {
					const bounds = textDiv.getBoundingClientRect()
					const pageBounds = pageElement.getBoundingClientRect()
					const topLeft = viewport.convertToPdfPoint(bounds.left - pageBounds.left, bounds.top - pageBounds.top)
					const bottomRight = viewport.convertToPdfPoint(bounds.right - pageBounds.left, bounds.bottom - pageBounds.top)
					const computedStyle = window.getComputedStyle(textDiv)
					textDiv.dataset.pdfPatch = JSON.stringify({
						x: Math.min(topLeft[0], bottomRight[0]),
						y: Math.min(topLeft[1], bottomRight[1]),
						width: Math.abs(bottomRight[0] - topLeft[0]),
						height: Math.abs(bottomRight[1] - topLeft[1]),
						fontSize: Number.parseFloat(computedStyle.fontSize) / viewport.scale,
						fontFamily: computedStyle.fontFamily,
						color: computedStyle.color,
					})
				}
				textDiv.classList.add('prime-pdf-text-editing')
			}
			const handleInput = (event) => {
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv) return
				const originalText = textLayer.textContentItemsStr[Number(textDiv.dataset.pdfTextIndex)]
				const geometry = textDiv.dataset.pdfPatch
				if (!originalText || !geometry) return
				textDiv.dataset.pdfEdited = 'true'
				textDiv.classList.add('prime-pdf-text-edited')
				onTextEdit({
					pageNumber,
					itemIndex: Number(textDiv.dataset.pdfTextIndex),
					originalText,
					replacementText: textDiv.innerText.replace(/\r/g, ''),
					...JSON.parse(geometry),
				})
			}
			const handleBlur = (event) => {
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv || textDiv.dataset.pdfEdited) return
				textDiv.classList.remove('prime-pdf-text-editing')
			}
			const textLayerElement = textLayerRef.current
			textLayerElement.addEventListener('focusin', handleFocus)
			textLayerElement.addEventListener('focusout', handleBlur)
			textLayerElement.addEventListener('input', handleInput)
			cleanupTextEvents = () => {
				textLayerElement.removeEventListener('focusin', handleFocus)
				textLayerElement.removeEventListener('focusout', handleBlur)
				textLayerElement.removeEventListener('input', handleInput)
			}
		}

		renderPage().catch((error) => {
			if (isCurrent) setPageError(error.message || `Could not render PDF page ${pageNumber}.`)
		})

		return () => {
			isCurrent = false
			renderTask?.cancel()
			textLayer?.cancel()
			cleanupTextEvents?.()
		}
	}, [document, editsEnabled, onTextEdit, pageNumber, pdfjsLibrary])

	return (
		<article className="prime-pdf-page" ref={pageRef} aria-label={`PDF page ${pageNumber}`}>
			<canvas ref={canvasRef} className="prime-pdf-canvas" />
			<div className={`textLayer prime-pdf-text-layer ${editsEnabled ? 'is-editable' : ''}`} ref={textLayerRef} />
			{pageError && <p className="prime-pdf-page-error" role="alert">{pageError}</p>}
		</article>
	)
}

function PrimePdfEditor() {
	const fileInputRef = useRef(null)
	const [file, setFile] = useState(null)
	const [pdfjsLibrary, setPdfjsLibrary] = useState(null)
	const [pdfDocument, setPdfDocument] = useState(null)
	const [pdfBytes, setPdfBytes] = useState(null)
	const [pageCount, setPageCount] = useState(0)
	const [edits, setEdits] = useState({})
	const [notice, setNotice] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [subscriptionActive, setSubscriptionActive] = useState(false)
	const [subscriptionChecked, setSubscriptionChecked] = useState(false)

	useEffect(() => {
		let isCurrent = true
		getUserSubscription()
			.then(({ subscription }) => {
				if (isCurrent) setSubscriptionActive(subscription.active)
			})
			.catch((error) => {
				if (isCurrent) setNotice(error.message)
			})
			.finally(() => {
				if (isCurrent) setSubscriptionChecked(true)
			})
		return () => { isCurrent = false }
	}, [])

	useEffect(() => {
		if (!file) return undefined
		let isCurrent = true
		let loadingTask

		async function loadPdf() {
			try {
				const library = await loadPdfJs()
				if (!isCurrent) return
				setPdfjsLibrary(library)
				const bytes = new Uint8Array(await file.arrayBuffer())
				loadingTask = library.getDocument({ data: bytes.slice() })
				const loadedDocument = await loadingTask.promise
				if (!isCurrent) {
					await loadedDocument.destroy()
					return
				}
				setPdfDocument(loadedDocument)
				setPdfBytes(bytes)
				setPageCount(loadedDocument.numPages)
			} catch (error) {
				if (isCurrent) {
					setNotice(error.message || 'This PDF could not be opened. It may be damaged or password-protected.')
					setFile(null)
					setPdfDocument(null)
					setPdfjsLibrary(null)
				}
			} finally {
				if (isCurrent) setIsLoading(false)
			}
		}

		loadPdf()
		return () => {
			isCurrent = false
			loadingTask?.destroy()
		}
	}, [file])

	const recordEdit = useCallback((edit) => {
		const key = `${edit.pageNumber}:${edit.itemIndex}`
		setEdits((current) => ({ ...current, [key]: edit }))
	}, [])

	function openFile(nextFile) {
		if (!nextFile) return
		if (nextFile.type !== 'application/pdf' && !nextFile.name.toLowerCase().endsWith('.pdf')) {
			setNotice('Choose a PDF document.')
			return
		}
		if (nextFile.size > MAX_FILE_SIZE) {
			setNotice('Choose a PDF smaller than 50 MB.')
			return
		}
		setIsLoading(true)
		setNotice('')
		setEdits({})
		setFile(nextFile)
		setPdfDocument(null)
		setPdfBytes(null)
		setPageCount(0)
		setEdits({})
	}

	function handleFileChange(event) {
		openFile(event.target.files?.[0])
		event.target.value = ''
	}

	function handleDrop(event) {
		event.preventDefault()
		openFile(event.dataTransfer.files?.[0])
	}

	async function downloadEditedPdf() {
		if (!pdfBytes || !Object.keys(edits).length) return
		if (!subscriptionActive) {
			setNotice('An active editing pass is required to download the edited PDF.')
			return
		}

		setIsSaving(true)
		setNotice('')
		try {
			const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
			const output = await PDFDocument.load(pdfBytes)
			const fonts = new Map()

			for (const edit of Object.values(edits)) {
				const page = output.getPage(edit.pageNumber - 1)
				const fontName = fontNameForFamily(edit.fontFamily, StandardFonts)
				if (!fonts.has(fontName)) fonts.set(fontName, await output.embedFont(fontName))
				const font = fonts.get(fontName)
				const fontSize = Math.max(4, Math.min(edit.fontSize, edit.height * 0.9))
				const boxHeight = Math.max(edit.height, fontSize * 1.15)

				page.drawRectangle({
					x: edit.x,
					y: edit.y - (boxHeight - edit.height) / 2,
					width: Math.min(
						Math.max(edit.width, font.widthOfTextAtSize(edit.originalText, fontSize)),
						page.getWidth() - edit.x,
					),
					height: boxHeight,
					color: rgb(1, 1, 1),
				})

				if (edit.replacementText) {
					const availableWidth = Math.max(edit.width - 1, 1)
					const textWidth = font.widthOfTextAtSize(edit.replacementText, fontSize)
					const fittedSize = textWidth > availableWidth
						? Math.max(4, fontSize * availableWidth / textWidth)
						: fontSize
					page.drawText(edit.replacementText, {
						x: edit.x,
						y: edit.y - font.descentAtSize(fittedSize),
						size: fittedSize,
						font,
						color: parseColor(edit.color, rgb),
						maxWidth: availableWidth,
					})
				}

			}

			const result = await output.save()
			const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }))
			const link = document.createElement('a')
			link.href = url
			link.download = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`
			link.click()
			setTimeout(() => URL.revokeObjectURL(url), 0)
			setNotice('Edited PDF downloaded. Text changes use visual covers; original text may remain embedded underneath.')
		} catch (error) {
			setNotice(error.message || 'Could not export the edited PDF.')
		} finally {
			setIsSaving(false)
		}
	}

	const editCount = Object.keys(edits).length

	return (
		<main className="dashboard-layout">
			<Sidebar active="editor" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> PDF editor</div>
					<a className="dashboard-account-link" href="/profile">
						<span className="dashboard-account-avatar" aria-hidden="true">W</span>
						<span>My account</span>
					</a>
				</header>

				<div className="document-editor-main">
					<div className="document-editor-heading">
						<div>
							<p className="dashboard-eyebrow">DOCUMENT WORKSPACE</p>
							<h1>Prime PDF editor</h1>
						</div>
						<span className="editor-engine-status connected"><span />BROWSER PDF EDITOR</span>
					</div>

					<section className="document-editor-shell" aria-label="PDF text editing workspace">
						<div className="document-editor-toolbar">
							<div className="editor-file-details">
								<span className="editor-file-mark" aria-hidden="true">PDF</span>
								<span className="editor-file-name">{file?.name || 'No document open'}</span>
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
								{pdfDocument && (
									<button className="editor-open-button" type="button" onClick={downloadEditedPdf} disabled={!editCount || !subscriptionChecked || !subscriptionActive || isSaving}>
										{isSaving ? 'Preparing PDF…' : `Download edited PDF${editCount ? ` (${editCount})` : ''}`}
									</button>
								)}
							</div>
						</div>

						{notice && <p className="prime-pdf-notice" role="status">{notice}</p>}
						<div className="prime-pdf-workspace" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
							{isLoading && <p className="prime-pdf-loading">Opening PDF…</p>}
							{pdfDocument && Array.from({ length: pageCount }, (_, index) => (
								<PdfPage
									key={`${file.name}:${index + 1}`}
									document={pdfDocument}
									pdfjsLibrary={pdfjsLibrary}
									pageNumber={index + 1}
									editsEnabled
									onTextEdit={recordEdit}
								/>
							))}
							{!file && !isLoading && (
								<div className="editor-empty-state">
									<span className="editor-empty-icon" aria-hidden="true">PDF</span>
									<h2>Open a document to get started</h2>
									<p>Drop a PDF here or choose one from your device. Click in the text to edit it.</p>
									<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()}>Choose PDF</button>
								</div>
							)}
						</div>
					</section>
					<div className="document-editor-footer">
						<p>{pdfDocument
							? editCount
								? `${editCount} text area${editCount === 1 ? '' : 's'} changed. Click text, select a word, then type or press Backspace.`
								: 'Click within PDF text to place the caret; select a word, then type to replace it or press Backspace to erase it.'
							: subscriptionActive
								? 'Edits are processed in your browser; PDFs are not uploaded to the server.'
								: 'An active editing pass is required to download edited PDFs.'}</p>
						{!subscriptionActive && <a href="/pricing">View PDF plans <span aria-hidden="true">→</span></a>}
					</div>
					<p className="prime-pdf-disclaimer">This editor uses visual white covers and replacement text. It does not securely remove original PDF text, and font matching depends on the PDF and available fonts.</p>
				</div>
			</section>
		</main>
	)
}

export default PrimePdfEditor
