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

function PdfPage({ document, pdfjsLibrary, pageNumber, editsEnabled, addTextMode, addedTexts, onTextEdit }) {
	const pageRef = useRef(null)
	const canvasRef = useRef(null)
	const textLayerRef = useRef(null)
	const addTextModeRef = useRef(addTextMode)
	const [pageError, setPageError] = useState('')

	useEffect(() => {
		addTextModeRef.current = addTextMode
	}, [addTextMode])

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
				textDiv.dataset.pdfTextKey = `${pageNumber}:${itemIndex}`
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
			const handlePageClick = (event) => {
				if (!addTextModeRef.current || event.target.closest('[data-pdf-text-index], [data-added-text]')) return
				const bounds = pageElement.getBoundingClientRect()
				const left = event.clientX - bounds.left
				const top = event.clientY - bounds.top
				const [x, y] = viewport.convertToPdfPoint(left, top)
				onTextEdit({
					type: 'add',
					pageNumber,
					x,
					y,
					left,
					top,
					text: 'New text',
					fontSize: 12,
					color: '#171c19',
					fontFamily: 'Arial',
				})
			}
			const textLayerElement = textLayerRef.current
			textLayerElement.addEventListener('focusin', handleFocus)
			textLayerElement.addEventListener('focusout', handleBlur)
			textLayerElement.addEventListener('input', handleInput)
			pageElement.addEventListener('click', handlePageClick)
			cleanupTextEvents = () => {
				textLayerElement.removeEventListener('focusin', handleFocus)
				textLayerElement.removeEventListener('focusout', handleBlur)
				textLayerElement.removeEventListener('input', handleInput)
				pageElement.removeEventListener('click', handlePageClick)
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
			{addedTexts.filter((item) => item.pageNumber === pageNumber).map((item) => (
				<textarea
					key={item.id}
					data-added-text={item.id}
					className="prime-pdf-added-text"
					aria-label="Added PDF text"
					value={item.text}
					placeholder="Type text"
					onChange={(event) => onTextEdit({ ...item, text: event.target.value })}
					style={{ left: item.left, top: item.top, fontSize: `${item.fontSize * PAGE_SCALE}px` }}
				/>
			))}
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
	const [addedTexts, setAddedTexts] = useState([])
	const [notice, setNotice] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [subscriptionActive, setSubscriptionActive] = useState(false)
	const [subscriptionChecked, setSubscriptionChecked] = useState(false)
	const [isAddingText, setIsAddingText] = useState(false)
	const [canUndo, setCanUndo] = useState(false)
	const [canRedo, setCanRedo] = useState(false)
	const [isSaved, setIsSaved] = useState(true)
	const [historyRestoreVersion, setHistoryRestoreVersion] = useState(0)
	const editsRef = useRef({})
	const addedTextsRef = useRef([])
	const historyRef = useRef([{ edits: {}, addedTexts: [] }])
	const historyIndexRef = useRef(0)

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

	const recordChange = useCallback((nextEdits, nextAddedTexts) => {
		const history = historyRef.current.slice(0, historyIndexRef.current + 1)
		history.push({ edits: nextEdits, addedTexts: nextAddedTexts })
		if (history.length > 100) history.shift()
		historyRef.current = history
		historyIndexRef.current = history.length - 1
		editsRef.current = nextEdits
		addedTextsRef.current = nextAddedTexts
		setEdits(nextEdits)
		setAddedTexts(nextAddedTexts)
		setCanUndo(historyIndexRef.current > 0)
		setCanRedo(false)
		setIsSaved(false)
	}, [])

	const recordEdit = useCallback((edit) => {
		if (edit.type === 'add') {
			recordChange(editsRef.current, [...addedTextsRef.current, { ...edit, id: crypto.randomUUID() }])
			setIsAddingText(false)
			setNotice('Text box added. Type into it, then save/download the PDF.')
			return
		}
		if (edit.id) {
			const nextAddedTexts = addedTextsRef.current.map((item) => item.id === edit.id ? edit : item)
			recordChange(editsRef.current, nextAddedTexts)
			return
		}

		const key = `${edit.pageNumber}:${edit.itemIndex}`
		recordChange({ ...editsRef.current, [key]: edit }, addedTextsRef.current)
	}, [recordChange])

	const restoreHistory = useCallback((index) => {
		if (index < 0 || index >= historyRef.current.length || index === historyIndexRef.current) return
		historyIndexRef.current = index
		const snapshot = historyRef.current[index]
		editsRef.current = snapshot.edits
		addedTextsRef.current = snapshot.addedTexts
		setEdits(snapshot.edits)
		setAddedTexts(snapshot.addedTexts)
		setCanUndo(index > 0)
		setCanRedo(index < historyRef.current.length - 1)
		setIsSaved(false)
		setHistoryRestoreVersion((version) => version + 1)
		setNotice(index < historyRef.current.length - 1 ? 'Edit undone.' : 'Edit restored.')
	}, [])

	function undoEdit() {
		restoreHistory(historyIndexRef.current - 1)
	}

	function redoEdit() {
		restoreHistory(historyIndexRef.current + 1)
	}

	function discardEdits() {
		if (!Object.keys(editsRef.current).length && !addedTextsRef.current.length) return
		const emptySnapshot = { edits: {}, addedTexts: [] }
		historyRef.current = [emptySnapshot]
		historyIndexRef.current = 0
		editsRef.current = emptySnapshot.edits
		addedTextsRef.current = emptySnapshot.addedTexts
		setEdits(emptySnapshot.edits)
		setAddedTexts(emptySnapshot.addedTexts)
		setCanUndo(false)
		setCanRedo(false)
		setIsSaved(true)
		setHistoryRestoreVersion((version) => version + 1)
		setIsAddingText(false)
		setNotice('All unsaved edits were discarded.')
	}

	useEffect(() => {
		if (!historyRestoreVersion) return
		document.querySelectorAll('.prime-pdf-text-layer [data-pdf-text-key]').forEach((textElement) => {
			const edit = edits[textElement.dataset.pdfTextKey]
			const originalText = textElement.getAttribute('aria-label')?.replace(/^PDF text: /, '') || ''
			textElement.textContent = edit?.replacementText ?? originalText
			textElement.classList.toggle('prime-pdf-text-edited', Boolean(edit))
			if (edit) textElement.dataset.pdfEdited = 'true'
			else delete textElement.dataset.pdfEdited
		})
	}, [edits, historyRestoreVersion])

	useEffect(() => {
		function handleHistoryShortcut(event) {
			if (!(event.ctrlKey || event.metaKey)) return
			if (!event.target.closest?.('.prime-pdf-workspace')) return
			const key = event.key.toLowerCase()
			if (key !== 'z' && !(key === 'y' && !event.metaKey)) return
			event.preventDefault()
			if (event.shiftKey || key === 'y') redoEdit()
			else undoEdit()
		}
		document.addEventListener('keydown', handleHistoryShortcut)
		return () => document.removeEventListener('keydown', handleHistoryShortcut)
	})

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
		if (!isSaved && (Object.keys(editsRef.current).length || addedTextsRef.current.length) &&
			!window.confirm('You have unsaved PDF edits. Discard them and open another file?')) return
		setIsLoading(true)
		setNotice('')
		editsRef.current = {}
		addedTextsRef.current = []
		historyRef.current = [{ edits: {}, addedTexts: [] }]
		historyIndexRef.current = 0
		setEdits({})
		setAddedTexts([])
		setCanUndo(false)
		setCanRedo(false)
		setIsSaved(true)
		setIsAddingText(false)
		setFile(nextFile)
		setPdfDocument(null)
		setPdfBytes(null)
		setPageCount(0)
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
		if (!pdfBytes || (!Object.keys(edits).length && !addedTexts.length)) return
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

			for (const addedText of addedTexts) {
				if (!addedText.text.trim()) continue
				const page = output.getPage(addedText.pageNumber - 1)
				const fontName = fontNameForFamily(addedText.fontFamily, StandardFonts)
				if (!fonts.has(fontName)) fonts.set(fontName, await output.embedFont(fontName))
				const font = fonts.get(fontName)
				page.drawText(addedText.text, {
					x: addedText.x,
					y: addedText.y - font.descentAtSize(addedText.fontSize),
					size: addedText.fontSize,
					font,
					color: parseColor(addedText.color, rgb),
					maxWidth: Math.max(page.getWidth() - addedText.x, 1),
				})
			}

			const result = await output.save()
			const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }))
			const link = document.createElement('a')
			link.href = url
			link.download = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`
			link.click()
			setTimeout(() => URL.revokeObjectURL(url), 0)
			setIsSaved(true)
			setNotice('Edited PDF saved to your device. Your original file was not changed.')
		} catch (error) {
			setNotice(error.message || 'Could not export the edited PDF.')
		} finally {
			setIsSaving(false)
		}
	}

	const editCount = Object.keys(edits).length + addedTexts.length

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
								<div className="prime-pdf-file-summary">
									<span className="editor-file-name">{file?.name || 'No document open'}</span>
									{pdfDocument && <span className="prime-pdf-file-meta">{pageCount} pages · {isSaved ? 'Saved' : 'Unsaved changes'}</span>}
								</div>
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
									<>
										<button className="editor-open-button" type="button" onClick={undoEdit} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
										<button className="editor-open-button" type="button" onClick={redoEdit} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
										<button
											className={`editor-open-button ${isAddingText ? 'is-active' : ''}`}
											type="button"
											onClick={() => {
												setIsAddingText((current) => !current)
												setNotice(isAddingText ? '' : 'Click anywhere on a PDF page to place a new text box.')
											}}
											aria-pressed={isAddingText}
										>
											{isAddingText ? 'Cancel add text' : 'Add text'}
										</button>
										<button className="editor-open-button" type="button" onClick={discardEdits} disabled={!editCount}>
											Discard edits
										</button>
										<button className="editor-open-button editor-save-button" type="button" onClick={downloadEditedPdf} disabled={!editCount || !subscriptionChecked || !subscriptionActive || isSaving}>
											{isSaving ? 'Saving PDF…' : 'Save / Download PDF'}
										</button>
									</>
								)}
							</div>
						</div>

						{notice && <p className="prime-pdf-notice" role="status">{notice}</p>}
						<div
							className={`prime-pdf-workspace ${isAddingText ? 'is-adding-text' : ''}`}
							onDragOver={(event) => event.preventDefault()}
							onDrop={handleDrop}
						>
							{isLoading && <p className="prime-pdf-loading">Opening PDF…</p>}
							{pdfDocument && Array.from({ length: pageCount }, (_, index) => (
								<PdfPage
									key={`${file.name}:${index + 1}`}
									document={pdfDocument}
									pdfjsLibrary={pdfjsLibrary}
									pageNumber={index + 1}
									editsEnabled
									addTextMode={isAddingText}
									addedTexts={addedTexts}
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
							? isAddingText
								? 'Add text mode: click a page to place a text box, then type. Click Add text again to exit.'
								: editCount
									? `${editCount} edit${editCount === 1 ? '' : 's'} · select PDF text to change it, or use Undo, Redo, Discard, and Save / Download.`
									: 'Click PDF text to edit it. Select a word to replace it or press Backspace to erase. Use Add text to insert text anywhere.'
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
