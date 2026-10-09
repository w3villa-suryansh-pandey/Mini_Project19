import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import { getUserSubscription } from '../../services/api.js'
import { convertDocxToPdf } from '../../utils/docxToPdf.js'

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

function parsePageRange(value, pageCount) {
	const indexes = new Set()
	const parts = value.split(',').map((part) => part.trim())
	if (!parts.length || parts.some((part) => !part)) throw new Error('Enter pages like 1-3,5.')
	for (const part of parts) {
		const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
		if (!match) throw new Error('Enter pages like 1-3,5.')
		const first = Number(match[1])
		const last = Number(match[2] || match[1])
		if (first < 1 || last < first || last > pageCount) {
			throw new Error(`Page ranges must be between 1 and ${pageCount}.`)
		}
		for (let page = first; page <= last; page += 1) indexes.add(page - 1)
	}
	return [...indexes].sort((a, b) => a - b)
}

function PdfPage({
	document,
	pdfjsLibrary,
	pageNumber,
	rotation,
	editsEnabled,
	activeTool,
	addedTexts,
	annotations,
	onTextEdit,
	onAnnotation,
	onImagePlace,
}) {
	const pageRef = useRef(null)
	const canvasRef = useRef(null)
	const textLayerRef = useRef(null)
	const svgRef = useRef(null)
	const activeToolRef = useRef(activeTool)
	const drawingRef = useRef(null)
	const [drawingPreview, setDrawingPreview] = useState(null)
	const [pageViewport, setPageViewport] = useState(null)
	const [pageError, setPageError] = useState('')

	useEffect(() => {
		activeToolRef.current = activeTool
	}, [activeTool])

	useEffect(() => {
		let isCurrent = true
		let textLayer
		let renderTask
		let cleanupTextEvents
		const pageElement = pageRef.current

		async function renderPage() {
			const page = await document.getPage(pageNumber)
			if (!isCurrent) return

			const viewport = page.getViewport({ scale: PAGE_SCALE, rotation: (page.rotate + rotation) % 360 })
			setPageViewport(viewport)
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
				if (!['text', 'comment', 'signature', 'image'].includes(activeToolRef.current)
					|| event.target.closest('[data-pdf-text-index], [data-added-text]')) return
				const bounds = pageElement.getBoundingClientRect()
				const left = event.clientX - bounds.left
				const top = event.clientY - bounds.top
				const [x, y] = viewport.convertToPdfPoint(left, top)
				if (activeToolRef.current === 'image') {
					onImagePlace({ pageNumber, x, y, left, top })
					return
				}
				const text = activeToolRef.current === 'comment'
					? window.prompt('Enter your comment for this page:')
					: activeToolRef.current === 'signature'
						? window.prompt('Type the name for your signature:')
						: 'New text'
				if (!text?.trim()) return
				onTextEdit({
					type: 'add',
					annotationType: activeToolRef.current,
					pageNumber,
					x,
					y,
					left,
					top,
					text: text.trim(),
					fontSize: activeToolRef.current === 'signature' ? 18 : 12,
					color: '#171c19',
					fontFamily: activeToolRef.current === 'signature' ? 'Times Italic' : 'Arial',
				})
			}
			const textLayerElement = textLayerRef.current
			textLayerElement.addEventListener('focusin', handleFocus)
			textLayerElement.addEventListener('focusout', handleBlur)
			textLayerElement.addEventListener('input', handleInput)
			pageElement.addEventListener('click', handlePageClick)
			const svg = svgRef.current
			const getPoint = (event) => {
				const bounds = svg.getBoundingClientRect()
				const point = viewport.convertToPdfPoint(event.clientX - bounds.left, event.clientY - bounds.top)
				return { x: point[0], y: point[1] }
			}
			const handlePointerDown = (event) => {
				if (!['draw', 'highlight'].includes(activeToolRef.current)) return
				event.preventDefault()
				svg.setPointerCapture(event.pointerId)
				const point = getPoint(event)
				drawingRef.current = { type: activeToolRef.current, points: [point] }
				setDrawingPreview(drawingRef.current)
			}
			const handlePointerMove = (event) => {
				if (!drawingRef.current) return
				const point = getPoint(event)
				const points = [...drawingRef.current.points, point]
				drawingRef.current = { ...drawingRef.current, points }
				setDrawingPreview(drawingRef.current)
			}
			const handlePointerUp = (event) => {
				if (!drawingRef.current) return
				const drawing = drawingRef.current
				drawingRef.current = null
				setDrawingPreview(null)
				if (drawing.type === 'highlight' && drawing.points.length > 1) {
					const [start, end] = [drawing.points[0], getPoint(event)]
					onAnnotation({
						type: 'highlight',
						pageNumber,
						x: Math.min(start.x, end.x),
						y: Math.min(start.y, end.y),
						width: Math.abs(end.x - start.x),
						height: Math.abs(end.y - start.y),
					})
				} else if (drawing.type === 'draw' && drawing.points.length > 1) {
					onAnnotation({ type: 'draw', pageNumber, points: drawing.points })
				}
			}
			svg.addEventListener('pointerdown', handlePointerDown)
			svg.addEventListener('pointermove', handlePointerMove)
			svg.addEventListener('pointerup', handlePointerUp)
			cleanupTextEvents = () => {
				textLayerElement.removeEventListener('focusin', handleFocus)
				textLayerElement.removeEventListener('focusout', handleBlur)
				textLayerElement.removeEventListener('input', handleInput)
				pageElement.removeEventListener('click', handlePageClick)
				svg.removeEventListener('pointerdown', handlePointerDown)
				svg.removeEventListener('pointermove', handlePointerMove)
				svg.removeEventListener('pointerup', handlePointerUp)
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
	}, [document, editsEnabled, onAnnotation, onImagePlace, onTextEdit, pageNumber, pdfjsLibrary, rotation])

	const viewport = pageViewport
	const annotationRect = (annotation) => {
		if (!viewport) return { x: 0, y: 0, width: 0, height: 0 }
		const [left, top] = viewport.convertToViewportPoint(annotation.x, annotation.y + annotation.height)
		const [right, bottom] = viewport.convertToViewportPoint(annotation.x + annotation.width, annotation.y)
		return { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) }
	}
	const renderDrawing = (drawing, preview = false) => {
		if (drawing.type === 'highlight') {
			const rect = annotationRect(drawing)
			return <rect key={drawing.id || 'preview'} {...rect} fill="#ffdf6c" fillOpacity={preview ? 0.22 : 0.35} stroke={preview ? '#b38a12' : 'none'} />
		}
		if (!viewport) return null
		const points = drawing.points.map((point) => viewport.convertToViewportPoint(point.x, point.y).join(',')).join(' ')
		return <polyline key={drawing.id || 'preview'} points={points} fill="none" stroke="#24436e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	}

	return (
		<article className={`prime-pdf-page${activeTool === 'draw' || activeTool === 'highlight' ? ' is-marking' : ''}`} ref={pageRef} aria-label={`PDF page ${pageNumber}`}>
			<canvas ref={canvasRef} className="prime-pdf-canvas" />
			<div className={`textLayer prime-pdf-text-layer ${editsEnabled ? 'is-editable' : ''}`} ref={textLayerRef} />
			<svg ref={svgRef} className={`prime-pdf-annotation-layer${['draw', 'highlight'].includes(activeTool) ? ' is-active' : ''}`} viewBox={viewport ? `0 0 ${viewport.width} ${viewport.height}` : undefined} aria-label={`Annotations on page ${pageNumber}`}>
				{viewport && annotations.filter((item) => item.pageNumber === pageNumber && ['highlight', 'draw'].includes(item.type)).map((item) => renderDrawing(item))}
				{viewport && annotations.filter((item) => item.pageNumber === pageNumber && item.type === 'image').map((item) => {
					const rect = annotationRect(item)
					return <image key={item.id} {...rect} href={item.dataUrl} preserveAspectRatio="xMidYMid meet" />
				})}
				{drawingPreview && renderDrawing(drawingPreview, true)}
			</svg>
			{addedTexts.filter((item) => item.pageNumber === pageNumber).map((item) => (
				<textarea
					key={item.id}
					data-added-text={item.id}
					className={`prime-pdf-added-text${item.annotationType === 'comment' ? ' is-comment' : ''}${item.annotationType === 'signature' ? ' is-signature' : ''}`}
					aria-label={item.annotationType === 'comment' ? 'PDF comment' : item.annotationType === 'signature' ? 'PDF signature' : 'Added PDF text'}
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
	const mergeInputRef = useRef(null)
	const imageInputRef = useRef(null)
	const [file, setFile] = useState(null)
	const [pdfjsLibrary, setPdfjsLibrary] = useState(null)
	const [pdfDocument, setPdfDocument] = useState(null)
	const [pdfBytes, setPdfBytes] = useState(null)
	const [pageCount, setPageCount] = useState(0)
	const [edits, setEdits] = useState({})
	const [addedTexts, setAddedTexts] = useState([])
	const [annotations, setAnnotations] = useState([])
	const [pageOrder, setPageOrder] = useState([])
	const [deletedPages, setDeletedPages] = useState([])
	const [pageRotations, setPageRotations] = useState({})
	const [activeTool, setActiveTool] = useState('')
	const [pendingImage, setPendingImage] = useState(null)
	const [mergeFiles, setMergeFiles] = useState([])
	const [splitRange, setSplitRange] = useState('')
	const [notice, setNotice] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [subscriptionActive, setSubscriptionActive] = useState(false)
	const [subscriptionChecked, setSubscriptionChecked] = useState(false)
	const [subscriptionError, setSubscriptionError] = useState(false)
	const [canUndo, setCanUndo] = useState(false)
	const [canRedo, setCanRedo] = useState(false)
	const [isSaved, setIsSaved] = useState(true)
	const [historyRestoreVersion, setHistoryRestoreVersion] = useState(0)
	const editsRef = useRef({})
	const addedTextsRef = useRef([])
	const annotationsRef = useRef([])
	const pageOrderRef = useRef([])
	const deletedPagesRef = useRef([])
	const pageRotationsRef = useRef({})
	const historyRef = useRef([{ edits: {}, addedTexts: [], annotations: [], pageOrder: [], deletedPages: [], pageRotations: {} }])
	const historyIndexRef = useRef(0)

	useEffect(() => {
		let isCurrent = true
		getUserSubscription({ refresh: true })
			.then(({ subscription }) => {
				if (!isCurrent) return
				setSubscriptionActive(subscription.active)
				setSubscriptionError(false)
			})
			.catch((error) => {
				if (!isCurrent) return
				setSubscriptionError(true)
				setNotice(error.message || 'Could not check your PDF editing pass.')
			})
			.finally(() => {
				if (isCurrent) setSubscriptionChecked(true)
			})
		return () => { isCurrent = false }
	}, [])

	async function refreshSubscription() {
		setSubscriptionChecked(false)
		setSubscriptionError(false)
		try {
			const { subscription } = await getUserSubscription({ refresh: true })
			setSubscriptionActive(subscription.active)
			setNotice('')
		} catch (error) {
			setSubscriptionError(true)
			setNotice(error.message || 'Could not check your PDF editing pass.')
		} finally {
			setSubscriptionChecked(true)
		}
	}

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
				const initialOrder = Array.from({ length: loadedDocument.numPages }, (_, index) => index)
				pageOrderRef.current = initialOrder
				setPageOrder(initialOrder)
				historyRef.current = [{
					edits: {},
					addedTexts: [],
					annotations: [],
					pageOrder: initialOrder,
					deletedPages: [],
					pageRotations: {},
				}]
				historyIndexRef.current = 0
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

	const recordChange = useCallback((
		nextEdits,
		nextAddedTexts,
		nextAnnotations = annotationsRef.current,
		nextPageOrder = pageOrderRef.current,
		nextDeletedPages = deletedPagesRef.current,
		nextPageRotations = pageRotationsRef.current,
	) => {
		const history = historyRef.current.slice(0, historyIndexRef.current + 1)
		history.push({
			edits: nextEdits,
			addedTexts: nextAddedTexts,
			annotations: nextAnnotations,
			pageOrder: nextPageOrder,
			deletedPages: nextDeletedPages,
			pageRotations: nextPageRotations,
		})
		if (history.length > 100) history.shift()
		historyRef.current = history
		historyIndexRef.current = history.length - 1
		editsRef.current = nextEdits
		addedTextsRef.current = nextAddedTexts
		annotationsRef.current = nextAnnotations
		pageOrderRef.current = nextPageOrder
		deletedPagesRef.current = nextDeletedPages
		pageRotationsRef.current = nextPageRotations
		setEdits(nextEdits)
		setAddedTexts(nextAddedTexts)
		setAnnotations(nextAnnotations)
		setPageOrder(nextPageOrder)
		setDeletedPages(nextDeletedPages)
		setPageRotations(nextPageRotations)
		setCanUndo(historyIndexRef.current > 0)
		setCanRedo(false)
		setIsSaved(false)
	}, [])

	const recordEdit = useCallback((edit) => {
		if (edit.type === 'add') {
			recordChange(editsRef.current, [...addedTextsRef.current, { ...edit, id: crypto.randomUUID() }])
			setActiveTool('')
			setNotice(`${edit.annotationType === 'comment' ? 'Comment' : edit.annotationType === 'signature' ? 'Signature' : 'Text box'} added. Save / download to apply it to the PDF.`)
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

	const recordAnnotation = useCallback((annotation) => {
		recordChange(
			editsRef.current,
			addedTextsRef.current,
			[...annotationsRef.current, { ...annotation, id: crypto.randomUUID() }],
		)
		setActiveTool('')
		setNotice(`${annotation.type === 'highlight' ? 'Highlight' : 'Drawing'} added. Save / download to apply it to the PDF.`)
	}, [recordChange])

	const placeImage = useCallback(async (position) => {
		if (!pendingImage || !pdfDocument) {
			setNotice('Choose a PNG or JPEG image before placing it.')
			setActiveTool('')
			return
		}
		try {
			const page = await pdfDocument.getPage(position.pageNumber)
			const pageWidth = page.getViewport({ scale: 1 }).width
			const width = Math.min(180 / PAGE_SCALE, Math.max(pageWidth - position.x, 1))
			const height = width / (pendingImage.width / pendingImage.height)
			recordChange(editsRef.current, addedTextsRef.current, [
				...annotationsRef.current,
				{
					...position,
					type: 'image',
					width,
					height,
					dataUrl: pendingImage.dataUrl,
					mimeType: pendingImage.mimeType,
					id: crypto.randomUUID(),
				},
			])
			setPendingImage(null)
			setActiveTool('')
			setNotice('Image added. Save / download to apply it to the PDF.')
		} catch (error) {
			setNotice(error.message || 'The image could not be placed on this page.')
		}
	}, [pendingImage, pdfDocument, recordChange])

	const restoreHistory = useCallback((index) => {
		if (index < 0 || index >= historyRef.current.length || index === historyIndexRef.current) return
		historyIndexRef.current = index
		const snapshot = historyRef.current[index]
		editsRef.current = snapshot.edits
		addedTextsRef.current = snapshot.addedTexts
		annotationsRef.current = snapshot.annotations
		pageOrderRef.current = snapshot.pageOrder
		deletedPagesRef.current = snapshot.deletedPages
		pageRotationsRef.current = snapshot.pageRotations
		setEdits(snapshot.edits)
		setAddedTexts(snapshot.addedTexts)
		setAnnotations(snapshot.annotations)
		setPageOrder(snapshot.pageOrder)
		setDeletedPages(snapshot.deletedPages)
		setPageRotations(snapshot.pageRotations)
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

	function getEditCount() {
		const pageChanges = deletedPagesRef.current.length
			+ Object.values(pageRotationsRef.current).filter(Boolean).length
			+ pageOrderRef.current.filter((pageIndex, index) => pageIndex !== index).length
		return Object.keys(editsRef.current).length + addedTextsRef.current.length + annotationsRef.current.length + pageChanges
	}

	function discardEdits() {
		if (!getEditCount()) return
		const emptySnapshot = {
			edits: {},
			addedTexts: [],
			annotations: [],
			pageOrder: pdfDocument ? Array.from({ length: pageCount }, (_, index) => index) : [],
			deletedPages: [],
			pageRotations: {},
		}
		historyRef.current = [emptySnapshot]
		historyIndexRef.current = 0
		editsRef.current = emptySnapshot.edits
		addedTextsRef.current = emptySnapshot.addedTexts
		annotationsRef.current = emptySnapshot.annotations
		pageOrderRef.current = emptySnapshot.pageOrder
		deletedPagesRef.current = emptySnapshot.deletedPages
		pageRotationsRef.current = emptySnapshot.pageRotations
		setEdits(emptySnapshot.edits)
		setAddedTexts(emptySnapshot.addedTexts)
		setAnnotations(emptySnapshot.annotations)
		setPageOrder(emptySnapshot.pageOrder)
		setDeletedPages(emptySnapshot.deletedPages)
		setPageRotations(emptySnapshot.pageRotations)
		setCanUndo(false)
		setCanRedo(false)
		setIsSaved(true)
		setHistoryRestoreVersion((version) => version + 1)
		setActiveTool('')
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

	async function openFile(selectedFile) {
		let nextFile = selectedFile
		if (!nextFile) return
		if (isLoading || isSaving) return
		const isDocx = nextFile.name.toLowerCase().endsWith('.docx')
		if (isDocx && nextFile.size > 25 * 1024 * 1024) {
			setNotice('Choose a DOCX document smaller than 25 MB for browser conversion.')
			return
		}
		if (!isDocx && nextFile.type !== 'application/pdf' && !nextFile.name.toLowerCase().endsWith('.pdf')) {
			setNotice('Choose a PDF or DOCX document.')
			return
		}
		if (!isDocx && nextFile.size > MAX_FILE_SIZE) {
			setNotice('Choose a PDF smaller than 50 MB.')
			return
		}
		if (!isSaved && getEditCount() &&
			!window.confirm('You have unsaved PDF edits. Discard them and open another file?')) return
		setIsLoading(true)
		setNotice(isDocx ? 'Converting DOCX to a visual PDF in your browser…' : '')
		try {
			if (isDocx) {
				const pdfBlob = await convertDocxToPdf(nextFile)
				if (pdfBlob.size > MAX_FILE_SIZE) {
					throw new Error('The converted PDF is larger than 50 MB and cannot be opened in this editor.')
				}
				nextFile = new File(
					[pdfBlob],
					`${nextFile.name.replace(/\.docx$/i, '')}.pdf`,
					{ type: 'application/pdf', lastModified: Date.now() },
				)
			}
		} catch (error) {
			setIsLoading(false)
			setNotice(error.message || 'Could not convert this DOCX document to PDF.')
			return
		}
		editsRef.current = {}
		addedTextsRef.current = []
		annotationsRef.current = []
		pageOrderRef.current = []
		deletedPagesRef.current = []
		pageRotationsRef.current = {}
		historyRef.current = [{ edits: {}, addedTexts: [], annotations: [], pageOrder: [], deletedPages: [], pageRotations: {} }]
		historyIndexRef.current = 0
		setEdits({})
		setAddedTexts([])
		setAnnotations([])
		setPageOrder([])
		setDeletedPages([])
		setPageRotations({})
		setCanUndo(false)
		setCanRedo(false)
		setIsSaved(true)
		setActiveTool('')
		setFile(nextFile)
		setPdfDocument(null)
		setPdfBytes(null)
		setPageCount(0)
		setMergeFiles([])
		setIsSaved(true)
		if (isDocx) {
			setNotice('DOCX converted to PDF. This visual PDF keeps the page appearance; its original text is not editable as PDF text.')
		}
	}

	function handleFileChange(event) {
		openFile(event.target.files?.[0])
		event.target.value = ''
	}

	function handleDrop(event) {
		event.preventDefault()
		openFile(event.dataTransfer.files?.[0])
	}

	async function createEditedPdfBytes() {
		const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')
		const source = await PDFDocument.load(pdfBytes)
		const visibleOrder = pageOrder.filter((pageIndex) => !deletedPages.includes(pageIndex))
		if (!visibleOrder.length) throw new Error('A PDF must contain at least one page.')
		const output = await PDFDocument.create()
		const copiedPages = await output.copyPages(source, visibleOrder)
		const outputPageBySource = new Map()

		copiedPages.forEach((page, index) => {
			const sourceIndex = visibleOrder[index]
			const rotation = (pageRotations[sourceIndex] || 0) + page.getRotation().angle
			page.setRotation(degrees(((rotation % 360) + 360) % 360))
			output.addPage(page)
			outputPageBySource.set(sourceIndex + 1, page)
		})

		const fonts = new Map()
		for (const edit of Object.values(edits)) {
			const page = outputPageBySource.get(edit.pageNumber)
			if (!page) continue
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

		for (const textItem of addedTexts) {
			if (!textItem.text.trim()) continue
			const page = outputPageBySource.get(textItem.pageNumber)
			if (!page) continue
			const fontName = fontNameForFamily(textItem.fontFamily, StandardFonts)
			if (!fonts.has(fontName)) fonts.set(fontName, await output.embedFont(fontName))
			const font = fonts.get(fontName)
			page.drawText(textItem.text, {
				x: textItem.x,
				y: textItem.y - font.descentAtSize(textItem.fontSize),
				size: textItem.fontSize,
				font,
				color: parseColor(textItem.color, rgb),
				maxWidth: Math.max(page.getWidth() - textItem.x, 1),
			})
		}

		for (const annotation of annotations) {
			const page = outputPageBySource.get(annotation.pageNumber)
			if (!page) continue
			if (annotation.type === 'highlight') {
				page.drawRectangle({
					x: annotation.x,
					y: annotation.y,
					width: annotation.width,
					height: annotation.height,
					color: rgb(1, 0.82, 0.2),
					opacity: 0.35,
				})
			} else if (annotation.type === 'draw') {
				for (let index = 1; index < annotation.points.length; index += 1) {
					page.drawLine({
						start: annotation.points[index - 1],
						end: annotation.points[index],
						thickness: 1.8,
						color: rgb(0.14, 0.43, 0.35),
					})
				}
			} else if (annotation.type === 'image') {
				const imageBytes = await fetch(annotation.dataUrl).then((response) => response.arrayBuffer())
				const embeddedImage = annotation.mimeType === 'image/jpeg'
					? await output.embedJpg(imageBytes)
					: await output.embedPng(imageBytes)
				page.drawImage(embeddedImage, {
					x: annotation.x,
					y: annotation.y,
					width: annotation.width,
					height: annotation.height,
				})
			}
		}
		return output.save({ useObjectStreams: true })
	}

	function downloadBytes(bytes, name) {
		const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
		const link = document.createElement('a')
		link.href = url
		link.download = name
		link.click()
		setTimeout(() => URL.revokeObjectURL(url), 0)
	}

	async function downloadEditedPdf() {
		if (!pdfBytes) return
		if (!subscriptionActive) {
			setNotice('An active editing pass is required to download the edited PDF.')
			return
		}

		setIsSaving(true)
		setNotice('')
		try {
			const result = await createEditedPdfBytes()
			downloadBytes(result, `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`)
			setIsSaved(true)
			setNotice('Edited PDF saved to your device. Your original file was not changed.')
		} catch (error) {
			setNotice(error.message || 'Could not export the edited PDF.')
		} finally {
			setIsSaving(false)
		}
	}

	async function savePdf() {
		if (!pdfBytes) return
		if (!subscriptionActive) {
			setNotice('An active editing pass is required to save the edited PDF.')
			return
		}

		setIsSaving(true)
		setNotice('')
		try {
			const bytes = await createEditedPdfBytes()
			const suggestedName = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`
			if (typeof window.showSaveFilePicker === 'function') {
				try {
					const handle = await window.showSaveFilePicker({
						suggestedName,
						types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }],
					})
					const writable = await handle.createWritable()
					await writable.write(bytes)
					await writable.close()
				} catch (error) {
					if (error.name === 'AbortError') return
					throw error
				}
				setNotice('Edited PDF saved to the location you selected.')
			} else {
				downloadBytes(bytes, suggestedName)
				setNotice('This browser does not support choosing a save location. The edited PDF was downloaded instead.')
			}
			setIsSaved(true)
		} catch (error) {
			setNotice(error.message || 'Could not save the edited PDF.')
		} finally {
			setIsSaving(false)
		}
	}

	async function mergePdfs() {
		if (!pdfBytes || !mergeFiles.length || !subscriptionActive) {
			setNotice(!subscriptionActive ? 'An active editing pass is required to download merged PDFs.' : 'Choose at least one additional PDF to merge.')
			return
		}
		setIsSaving(true)
		setNotice('')
		try {
			const { PDFDocument } = await import('pdf-lib')
			const currentBytes = await createEditedPdfBytes()
			const output = await PDFDocument.load(currentBytes)
			for (const mergeFile of mergeFiles) {
				const source = await PDFDocument.load(await mergeFile.arrayBuffer())
				const pages = await output.copyPages(source, source.getPageIndices())
				pages.forEach((page) => output.addPage(page))
			}
			downloadBytes(await output.save({ useObjectStreams: true }), `${file.name.replace(/\.pdf$/i, '')}-merged.pdf`)
			setNotice(`Merged the edited document with ${mergeFiles.length} PDF file${mergeFiles.length === 1 ? '' : 's'}.`)
		} catch (error) {
			setNotice(error.message || 'Could not merge the selected PDFs.')
		} finally {
			setIsSaving(false)
		}
	}

	async function splitPdf() {
		if (!pdfBytes || !subscriptionActive) {
			setNotice('An active editing pass is required to download split PDFs.')
			return
		}
		setIsSaving(true)
		setNotice('')
		try {
			const { PDFDocument } = await import('pdf-lib')
			const currentBytes = await createEditedPdfBytes()
			const source = await PDFDocument.load(currentBytes)
			const selectedPages = parsePageRange(splitRange, source.getPageCount())
			const output = await PDFDocument.create()
			const copiedPages = await output.copyPages(source, selectedPages)
			copiedPages.forEach((page) => output.addPage(page))
			downloadBytes(await output.save({ useObjectStreams: true }), `${file.name.replace(/\.pdf$/i, '')}-split.pdf`)
			setNotice(`Downloaded a PDF containing ${selectedPages.length} selected page${selectedPages.length === 1 ? '' : 's'}.`)
		} catch (error) {
			setNotice(error.message || 'Could not split this PDF.')
		} finally {
			setIsSaving(false)
		}
	}

	function handleMergeFiles(event) {
		const selectedFiles = Array.from(event.target.files || [])
		event.target.value = ''
		const validFiles = selectedFiles.filter((nextFile) => (
			(nextFile.type === 'application/pdf' || nextFile.name.toLowerCase().endsWith('.pdf'))
			&& nextFile.size <= MAX_FILE_SIZE
		))
		if (validFiles.length !== selectedFiles.length) {
			setNotice('Only PDF files up to 50 MB each can be merged.')
		} else {
			setNotice('')
		}
		setMergeFiles((current) => [...current, ...validFiles])
	}

	function handleImageChange(event) {
		const imageFile = event.target.files?.[0]
		event.target.value = ''
		if (!imageFile) return
		if (!['image/png', 'image/jpeg'].includes(imageFile.type)) {
			setNotice('Choose a PNG or JPEG image to add to this PDF.')
			return
		}
		const reader = new FileReader()
		reader.onload = () => {
			const image = new Image()
			image.onload = () => {
				setPendingImage({
					dataUrl: reader.result,
					mimeType: imageFile.type,
					width: image.naturalWidth,
					height: image.naturalHeight,
				})
				setActiveTool('image')
				setNotice('Click a page to place the image.')
			}
			image.onerror = () => setNotice('This image could not be opened.')
			image.src = reader.result
		}
		reader.onerror = () => setNotice('This image could not be read.')
		reader.readAsDataURL(imageFile)
	}

	function movePage(pageIndex, direction) {
		const visibleOrder = pageOrder.filter((index) => !deletedPages.includes(index))
		const visibleSourceIndex = visibleOrder.indexOf(pageIndex)
		const targetPage = visibleOrder[visibleSourceIndex + direction]
		if (visibleSourceIndex < 0 || targetPage === undefined) return
		const sourceIndex = pageOrder.indexOf(pageIndex)
		const targetIndex = pageOrder.indexOf(targetPage)
		const reordered = [...pageOrder]
		;[reordered[sourceIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[sourceIndex]]
		recordChange(edits, addedTexts, annotations, reordered, deletedPages, pageRotations)
	}

	function rotatePage(pageIndex) {
		recordChange(edits, addedTexts, annotations, pageOrder, deletedPages, {
			...pageRotations,
			[pageIndex]: ((pageRotations[pageIndex] || 0) + 90) % 360,
		})
	}

	function deletePage(pageIndex) {
		const visiblePageCount = pageOrder.length - deletedPages.length
		if (visiblePageCount <= 1) {
			setNotice('A PDF must contain at least one page.')
			return
		}
		recordChange(edits, addedTexts, annotations, pageOrder, [...deletedPages, pageIndex], pageRotations)
	}

	const editCount = Object.keys(edits).length + addedTexts.length + annotations.length
		+ deletedPages.length
		+ Object.values(pageRotations).filter(Boolean).length
		+ pageOrder.filter((pageIndex, index) => pageIndex !== index).length

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
							<div className="editor-toolbar-actions prime-pdf-toolbar">
								<input
									ref={fileInputRef}
									className="editor-file-input"
									type="file"
									accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
									onChange={handleFileChange}
									disabled={isLoading || isSaving}
									aria-label="Choose a PDF or DOCX document"
								/>
								<input
									ref={mergeInputRef}
									className="editor-file-input"
									type="file"
									accept="application/pdf,.pdf"
									multiple
									onChange={handleMergeFiles}
									aria-label="Choose PDFs to merge"
								/>
								<input
									ref={imageInputRef}
									className="editor-file-input"
									type="file"
									accept="image/png,image/jpeg,.png,.jpg,.jpeg"
									onChange={handleImageChange}
									aria-label="Choose a PNG or JPEG image to add"
								/>
								<div className="prime-pdf-tool-group" role="group" aria-label="File">
									<span className="prime-pdf-tool-group-label">File</span>
									<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isSaving}>
										{isLoading ? 'Opening document…' : 'Open PDF / DOCX'}
									</button>
								</div>
								{pdfDocument && (
									<>
										<div className="prime-pdf-tool-group" role="group" aria-label="History">
											<span className="prime-pdf-tool-group-label">History</span>
											<button className="editor-open-button" type="button" onClick={undoEdit} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
											<button className="editor-open-button" type="button" onClick={redoEdit} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
										</div>
										<div className="prime-pdf-tool-group prime-pdf-annotation-tools" role="group" aria-label="Add and annotate">
											<span className="prime-pdf-tool-group-label">Add & annotate</span>
										{[
											['text', 'Add text', 'Click a page to add text.'],
											['highlight', 'Highlight', 'Drag over a page to highlight an area.'],
											['draw', 'Draw', 'Draw on a page with your pointer or finger.'],
											['comment', 'Comment', 'Click a page and enter a comment.'],
											['signature', 'Signature', 'Click a page and type the signature name.'],
										].map(([tool, label, message]) => (
											<button
												key={tool}
												className={`editor-open-button ${activeTool === tool ? 'is-active' : ''}`}
												type="button"
												onClick={() => {
													setActiveTool((current) => current === tool ? '' : tool)
													setNotice(activeTool === tool ? '' : message)
												}}
												aria-pressed={activeTool === tool}
											>
												{label}
											</button>
										))}
										<button className="editor-open-button" type="button" onClick={() => imageInputRef.current?.click()}>
											Add image
										</button>
										</div>
										<div className="prime-pdf-tool-group" role="group" aria-label="Organize pages and files">
											<span className="prime-pdf-tool-group-label">Organize</span>
											<button className="editor-open-button" type="button" onClick={() => mergeInputRef.current?.click()}>
												Merge PDFs
											</button>
											<div className="prime-pdf-split-control">
												<label htmlFor="prime-pdf-split-range">Split pages</label>
												<input
													id="prime-pdf-split-range"
													type="text"
													value={splitRange}
													onChange={(event) => setSplitRange(event.target.value)}
													placeholder="1-3,5"
													aria-label="Page range to split"
												/>
												<button className="editor-open-button" type="button" onClick={splitPdf} disabled={!subscriptionChecked || !subscriptionActive || isSaving}>
													Split
												</button>
											</div>
										<button className="editor-open-button" type="button" onClick={discardEdits} disabled={!editCount}>
											Discard edits
										</button>
										</div>
										<div className="prime-pdf-tool-group prime-pdf-export-tools" role="group" aria-label="Save and export">
										<span className="prime-pdf-tool-group-label">Save & export</span>
										<button className="editor-open-button" type="button" onClick={savePdf} disabled={!editCount || !subscriptionChecked || !subscriptionActive || isSaving}>
											{isSaving ? 'Saving PDF…' : 'Save PDF'}
										</button>
										<button className="editor-open-button editor-save-button" type="button" onClick={downloadEditedPdf} disabled={!subscriptionChecked || !subscriptionActive || isSaving}>
											{isSaving ? 'Preparing PDF…' : 'Download PDF'}
										</button>
										</div>
									</>
								)}
							</div>
						</div>

						{subscriptionChecked && !subscriptionActive && (
							<div className={`prime-pdf-access-notice${subscriptionError ? ' is-error' : ''}`} role={subscriptionError ? 'alert' : 'status'}>
								<span>{subscriptionError
									? 'Could not verify your PDF editing pass. Saving, merging, and splitting are unavailable until access is checked.'
									: 'An active PDF editing pass is required to save, merge, or split PDFs.'}</span>
								{subscriptionError
									? <button className="editor-open-button" type="button" onClick={refreshSubscription}>Retry check</button>
									: <a href="/pricing">View PDF plans</a>}
							</div>
						)}

						{mergeFiles.length > 0 && (
							<div className="prime-pdf-merge-list">
								<strong>PDFs to merge:</strong>
								{mergeFiles.map((mergeFile, index) => (
									<span key={`${mergeFile.name}-${mergeFile.lastModified}-${index}`}>
										{mergeFile.name}
										<button type="button" onClick={() => setMergeFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${mergeFile.name}`}>×</button>
									</span>
								))}
								<button className="editor-open-button editor-save-button" type="button" onClick={mergePdfs} disabled={!subscriptionChecked || !subscriptionActive || isSaving}>
									{isSaving ? 'Merging…' : 'Merge and download'}
								</button>
							</div>
						)}

						{notice && <p className="prime-pdf-notice" role="status">{notice}</p>}
						<div
							className={`prime-pdf-workspace ${activeTool ? `is-tool-${activeTool}` : ''}`}
							onDragOver={(event) => event.preventDefault()}
							onDrop={handleDrop}
						>
							{isLoading && <p className="prime-pdf-loading">Opening PDF…</p>}
							{pdfDocument && pageOrder
								.filter((pageIndex) => !deletedPages.includes(pageIndex))
								.map((pageIndex, visibleIndex, visiblePages) => (
									<div className="prime-pdf-page-wrap" key={`${file.name}:${pageIndex + 1}`}>
										<div className="prime-pdf-page-controls" aria-label={`Controls for page ${pageIndex + 1}`}>
											<strong>Page {visibleIndex + 1} <span>of {visiblePages.length}</span></strong>
											<button className="editor-open-button" type="button" onClick={() => movePage(pageIndex, -1)} disabled={!visibleIndex}>Move up</button>
											<button className="editor-open-button" type="button" onClick={() => movePage(pageIndex, 1)} disabled={visibleIndex === visiblePages.length - 1}>Move down</button>
											<button className="editor-open-button" type="button" onClick={() => rotatePage(pageIndex)}>Rotate 90°</button>
											<button className="editor-open-button" type="button" onClick={() => deletePage(pageIndex)}>Delete page</button>
										</div>
										<PdfPage
											document={pdfDocument}
											pdfjsLibrary={pdfjsLibrary}
											pageNumber={pageIndex + 1}
											rotation={pageRotations[pageIndex] || 0}
											editsEnabled
											activeTool={activeTool}
											addedTexts={addedTexts}
											annotations={annotations}
											onTextEdit={recordEdit}
											onAnnotation={recordAnnotation}
											onImagePlace={placeImage}
										/>
									</div>
								))}
							{!file && !isLoading && (
								<div className="editor-empty-state">
									<span className="editor-empty-icon" aria-hidden="true">PDF</span>
									<h2>Open a PDF to get started</h2>
									<p>Drop a PDF or DOCX here, or choose one from your device. DOCX files are converted to visual PDFs in your browser.</p>
									<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()}>Choose PDF</button>
								</div>
							)}
						</div>
					</section>
					<div className="document-editor-footer">
						<p>{pdfDocument
							? activeTool
								? `${activeTool[0].toUpperCase()}${activeTool.slice(1)} tool is active. ${activeTool === 'draw' || activeTool === 'highlight' ? 'Drag on a page to mark it.' : 'Click a page to place it.'}`
								: editCount
									? `${editCount} unsaved change${editCount === 1 ? '' : 's'} · use the page controls, annotation tools, Undo / Redo, and Save / Download.`
									: 'Select PDF text to replace it. Use the toolbar to annotate, insert an image/signature/comment, or manage pages.'
							: subscriptionError
								? 'Could not verify your PDF editing pass. Retry the check above.'
								: subscriptionActive
									? 'Edits are processed in your browser; PDFs are not uploaded to the server.'
									: subscriptionChecked
										? 'An active editing pass is required to download edited PDFs.'
										: 'Checking PDF editing access…'}</p>
					</div>
					<p className="prime-pdf-disclaimer">DOCX conversion creates a visual, image-based PDF, so its source text is not editable as PDF text. Comments and marks are flattened into the exported page, and text replacement uses a white cover rather than securely removing source text. Standard PDF password encryption is not available in the license-free PDF library.</p>
				</div>
			</section>
		</main>
	)
}

export default PrimePdfEditor
