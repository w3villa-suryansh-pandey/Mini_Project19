import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import WorkspaceHeader from '../../components/WorkspaceHeader.jsx'

import {
	applyPdfEditorChanges,
	downloadPdfEditorVersion,
	getPdfEditorDocument,
	getPdfEditorVersions,
	getUserProfile,
	getUserSubscription,
	previewPdfEditorChanges,
	uploadPdfEditorDocument,
} from '../../services/api.js'
import {
	getPdfEditorSessionId,
	loadPdfEditorSession,
	savePdfEditorDocument,
	savePdfEditorState,
} from '../../services/pdfEditorSession.js'
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
	zoom,
	pageNumber,
	rotation,
	editsRef,
	editsEnabled,
	activeTool,
	addedTexts,
	annotations,
	onTextEdit,
	onTextCancel,
	onTextCommit,
	onTextDelete,
	onAnnotation,
	onAnnotationEdit,
	onAnnotationDelete,
	onImagePlace,
	onPageRendered,
	onScannedPage,
	onTextSelect,
	renderKey,
}) {
	const pageRef = useRef(null)
	const canvasRef = useRef(null)
	const textLayerRef = useRef(null)
	const svgRef = useRef(null)
	const activeToolRef = useRef(activeTool)
	const drawingRef = useRef(null)
	const [drawingPreview, setDrawingPreview] = useState(null)
	const [imagePreview, setImagePreview] = useState(null)
	const [pageViewport, setPageViewport] = useState(null)
	const [pageError, setPageError] = useState('')
	const imageInteractionRef = useRef(null)

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

			const viewport = page.getViewport({ scale: PAGE_SCALE * zoom, rotation: (page.rotate + rotation) % 360 })
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
			const hasSelectableText = textContent.items.some((item) => typeof item.str === 'string' && item.str.trim())
			let hasPageImage = false
			if (!hasSelectableText) {
				try {
					const operatorList = await page.getOperatorList()
					const imageOps = new Set([
						pdfjsLibrary.OPS.paintImageXObject,
						pdfjsLibrary.OPS.paintInlineImageXObject,
						pdfjsLibrary.OPS.paintJpegXObject,
					])
					hasPageImage = operatorList.fnArray.some((operation) => imageOps.has(operation))
				} catch {
					hasPageImage = false
				}
			}
			onScannedPage(pageNumber, !hasSelectableText && hasPageImage)
			textLayerRef.current.replaceChildren()
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
				// The source PDF remains on the canvas beneath this editable layer.
				// Keep the source span's full width so its white background masks the
				// entire original run even when the replacement is shorter.
				if (!textDiv.dataset.pdfOriginalWidth) {
					textDiv.dataset.pdfOriginalWidth = String(textDiv.offsetWidth || textDiv.getBoundingClientRect().width)
				}
				const edit = editsRef.current[`${pageNumber}:${itemIndex}`]
				if (edit) {
					textDiv.style.minWidth = `${textDiv.dataset.pdfOriginalWidth}px`
					textDiv.textContent = edit.replacementText
					textDiv.dataset.pdfPatch = JSON.stringify(edit)
					textDiv.dataset.pdfEdited = 'true'
					textDiv.classList.add('prime-pdf-text-edited')
				}
			})

			const getTextPatch = (textDiv) => {
				if (textDiv.dataset.pdfPatch) return JSON.parse(textDiv.dataset.pdfPatch)
				const bounds = textDiv.getBoundingClientRect()
				const pageBounds = pageElement.getBoundingClientRect()
				const topLeft = viewport.convertToPdfPoint(bounds.left - pageBounds.left, bounds.top - pageBounds.top)
				const bottomRight = viewport.convertToPdfPoint(bounds.right - pageBounds.left, bounds.bottom - pageBounds.top)
				const computedStyle = window.getComputedStyle(textDiv)
				const colorValues = computedStyle.color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
				const textColor = colorValues?.length === 3
					? `#${colorValues.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`
					: '#000000'
				const patch = {
					x: Math.min(topLeft[0], bottomRight[0]),
					y: Math.min(topLeft[1], bottomRight[1]),
					width: Math.abs(bottomRight[0] - topLeft[0]),
					height: Math.abs(bottomRight[1] - topLeft[1]),
					fontSize: Number.parseFloat(computedStyle.fontSize) / viewport.scale,
					fontFamily: computedStyle.fontFamily,
					fontWeight: computedStyle.fontWeight,
					italic: computedStyle.fontStyle !== 'normal',
					alignment: computedStyle.textAlign,
					color: textColor,
				}
				textDiv.dataset.pdfPatch = JSON.stringify(patch)
				return patch
			}
			const handleFocus = (event) => {
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv || !pageElement) return
				const geometry = getTextPatch(textDiv)
				const itemIndex = Number(textDiv.dataset.pdfTextIndex)
				const currentEdit = editsRef.current[`${pageNumber}:${itemIndex}`]
				onTextSelect({
					...geometry,
					...currentEdit,
					pageNumber,
					itemIndex,
					originalText: textLayer.textContentItemsStr[itemIndex] || '',
				})
				textDiv.classList.add('prime-pdf-text-editing')
			}
			const handleTextPointerDown = (event) => {
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv || activeToolRef.current === 'erase' || !editsEnabled) return
				const itemIndex = Number(textDiv.dataset.pdfTextIndex)
				if (editsRef.current[`${pageNumber}:${itemIndex}`]) return
				// Stop the browser placing a caret at the click position. The first
				// click selects the source span so typing replaces the whole text run.
				event.preventDefault()
				textDiv.focus()
				const selection = window.getSelection()
				const range = window.document.createRange()
				range.selectNodeContents(textDiv)
				selection?.removeAllRanges()
				selection?.addRange(range)
			}
			const handleInput = (event) => {
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv) return
				const originalText = textLayer.textContentItemsStr[Number(textDiv.dataset.pdfTextIndex)]
				if (!originalText) return
				const geometry = getTextPatch(textDiv)
				const itemIndex = Number(textDiv.dataset.pdfTextIndex)
				const currentEdit = editsRef.current[`${pageNumber}:${itemIndex}`]
				textDiv.dataset.pdfEdited = 'true'
				textDiv.classList.add('prime-pdf-text-edited')
				onTextEdit({
					...geometry,
					...currentEdit,
					pageNumber,
					itemIndex,
					originalText,
					replacementText: textDiv.innerText.replace(/\r/g, ''),
				})
			}
			const handleTextKeyDown = (event) => {
				if (event.key !== 'Escape') return
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv) return
				event.preventDefault()
				const itemIndex = Number(textDiv.dataset.pdfTextIndex)
				textDiv.textContent = textLayer.textContentItemsStr[itemIndex] || ''
				textDiv.style.minWidth = ''
				textDiv.classList.remove('prime-pdf-text-editing', 'prime-pdf-text-edited')
				delete textDiv.dataset.pdfEdited
				onTextCancel({ pageNumber, itemIndex })
			}
			const handleBlur = (event) => {
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv) return
				// Edits are recorded on input; blur only closes the active edit UI.
				textDiv.classList.remove('prime-pdf-text-editing')
			}
			const handlePageClick = (event) => {
				if (!['text', 'comment', 'signature', 'image', 'rectangle', 'ellipse'].includes(activeToolRef.current)
					|| event.target.closest('[data-pdf-text-index], [data-added-text]')) return
				const bounds = pageElement.getBoundingClientRect()
				const left = event.clientX - bounds.left
				const top = event.clientY - bounds.top
				const [x, y] = viewport.convertToPdfPoint(left, top)
				if (activeToolRef.current === 'image') {
					onImagePlace({ pageNumber, x, y, left, top })
					return
				}
				if (activeToolRef.current === 'rectangle' || activeToolRef.current === 'ellipse') {
					const scale = PAGE_SCALE * zoom
					onAnnotation({
						type: activeToolRef.current,
						pageNumber,
						x,
						y,
						width: 110 / scale,
						height: 72 / scale,
					})
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
					selectOnFocus: activeToolRef.current === 'text',
					isEditing: true,
					width: 180 / (PAGE_SCALE * zoom),
					height: 36 / (PAGE_SCALE * zoom),
					fontSize: activeToolRef.current === 'signature' ? 18 : 12,
					color: '#171c19',
					fontFamily: activeToolRef.current === 'signature' ? 'Times Italic' : 'Arial',
				})
			}
			const textLayerElement = textLayerRef.current
			const handleEraseClick = (event) => {
				if (activeToolRef.current !== 'erase') return
				const textDiv = event.target.closest('[data-pdf-text-index]')
				if (!textDiv) return
				event.preventDefault()
				event.stopPropagation()
				const itemIndex = Number(textDiv.dataset.pdfTextIndex)
				const currentEdit = editsRef.current[`${pageNumber}:${itemIndex}`]
				if (currentEdit?.replacementText === '') return
				const originalText = currentEdit?.originalText || textLayer.textContentItemsStr[itemIndex]
				if (!originalText?.trim()) return
				const geometry = currentEdit || getTextPatch(textDiv)
				textDiv.dataset.pdfEdited = 'true'
				textDiv.style.minWidth = `${textDiv.dataset.pdfOriginalWidth}px`
				textDiv.textContent = ''
				textDiv.classList.add('prime-pdf-text-edited')
				onTextEdit({
					...geometry,
					pageNumber,
					itemIndex,
					originalText,
					replacementText: '',
				})
			}
			textLayerElement.addEventListener('click', handleEraseClick, true)
			textLayerElement.addEventListener('pointerdown', handleTextPointerDown, true)
			textLayerElement.addEventListener('focusin', handleFocus)
			textLayerElement.addEventListener('focusout', handleBlur)
			textLayerElement.addEventListener('input', handleInput)
			textLayerElement.addEventListener('keydown', handleTextKeyDown)
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
				textLayerElement.removeEventListener('click', handleEraseClick, true)
				textLayerElement.removeEventListener('pointerdown', handleTextPointerDown, true)
				textLayerElement.removeEventListener('focusin', handleFocus)
				textLayerElement.removeEventListener('focusout', handleBlur)
				textLayerElement.removeEventListener('input', handleInput)
				textLayerElement.removeEventListener('keydown', handleTextKeyDown)
				pageElement.removeEventListener('click', handlePageClick)
				svg.removeEventListener('pointerdown', handlePointerDown)
				svg.removeEventListener('pointermove', handlePointerMove)
				svg.removeEventListener('pointerup', handlePointerUp)
			}
		}
		onPageRendered(renderKey)

		renderPage().catch((error) => {
			if (isCurrent) setPageError(error.message || `Could not render PDF page ${pageNumber}.`)
		})

		return () => {
			isCurrent = false
			renderTask?.cancel()
			textLayer?.cancel()
			cleanupTextEvents?.()
		}
	}, [document, editsEnabled, editsRef, onAnnotation, onImagePlace, onPageRendered, onScannedPage, onTextCancel, onTextEdit, onTextSelect, pageNumber, pdfjsLibrary, renderKey, rotation, zoom])

	const viewport = pageViewport
	const annotationRect = (annotation) => {
		if (!viewport) return { x: 0, y: 0, width: 0, height: 0 }
		const [left, top] = viewport.convertToViewportPoint(annotation.x, annotation.y + annotation.height)
		const [right, bottom] = viewport.convertToViewportPoint(annotation.x + annotation.width, annotation.y)
		return { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) }
	}
	const renderDrawing = (drawing, preview = false) => {
		if (drawing.type === 'rectangle' || drawing.type === 'ellipse') {
			const rect = annotationRect(drawing)
			if (drawing.type === 'rectangle') {
				return <rect key={drawing.id || 'preview'} {...rect} fill="none" stroke="#4269c8" strokeWidth="2" />
			}
			return <ellipse key={drawing.id || 'preview'} cx={rect.x + rect.width / 2} cy={rect.y + rect.height / 2} rx={rect.width / 2} ry={rect.height / 2} fill="none" stroke="#4269c8" strokeWidth="2" />
		}
		if (drawing.type === 'highlight') {
			const rect = annotationRect(drawing)
			return <rect key={drawing.id || 'preview'} {...rect} fill="#ffdf6c" fillOpacity={preview ? 0.22 : 0.35} stroke={preview ? '#b38a12' : 'none'} />
		}
		if (!viewport) return null
		const points = drawing.points.map((point) => viewport.convertToViewportPoint(point.x, point.y).join(',')).join(' ')
		return <polyline key={drawing.id || 'preview'} points={points} fill="none" stroke="#24436e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	}
	const imageRect = (annotation) => {
		if (!viewport) return { left: 0, top: 0, width: 0, height: 0 }
		const [left, top] = viewport.convertToViewportPoint(annotation.x, annotation.y + annotation.height)
		const [right, bottom] = viewport.convertToViewportPoint(annotation.x + annotation.width, annotation.y)
		return { left: Math.min(left, right), top: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) }
	}
	const getImagePoint = (event) => {
		const bounds = pageRef.current.getBoundingClientRect()
		const [x, y] = viewport.convertToPdfPoint(event.clientX - bounds.left, event.clientY - bounds.top)
		return { x, y }
	}
	const startImageInteraction = (event, annotation) => {
		if (!viewport) return
		event.preventDefault()
		event.stopPropagation()
		event.currentTarget.setPointerCapture(event.pointerId)
		imageInteractionRef.current = {
			id: annotation.id,
			mode: event.target.closest('[data-image-resize]') ? 'resize' : 'move',
			start: getImagePoint(event),
			original: annotation,
		}
		setImagePreview(annotation)
	}
	const moveImageInteraction = (event) => {
		const interaction = imageInteractionRef.current
		if (!interaction) return
		const point = getImagePoint(event)
		const deltaX = point.x - interaction.start.x
		const deltaY = point.y - interaction.start.y
		const pageWidth = viewport.viewBox[2]
		const pageHeight = viewport.viewBox[3]
		let next

		if (interaction.mode === 'move') {
			next = {
				...interaction.original,
				x: Math.min(Math.max(interaction.original.x + deltaX, 0), pageWidth - interaction.original.width),
				y: Math.min(Math.max(interaction.original.y + deltaY, 0), pageHeight - interaction.original.height),
			}
		} else {
			const scale = Math.max(0.1, 1 + Math.max(
				deltaX / interaction.original.width,
				-deltaY / interaction.original.height,
			))
			const width = Math.min(interaction.original.width * scale, pageWidth - interaction.original.x)
			const height = Math.min(interaction.original.height * (width / interaction.original.width), pageHeight - interaction.original.y)
			next = { ...interaction.original, width, height }
		}
		setImagePreview(next)
	}
	const finishImageInteraction = (event) => {
		const interaction = imageInteractionRef.current
		if (!interaction) return
		const point = getImagePoint(event)
		const deltaX = point.x - interaction.start.x
		const deltaY = point.y - interaction.start.y
		const pageWidth = viewport.viewBox[2]
		const pageHeight = viewport.viewBox[3]
		if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
			imageInteractionRef.current = null
			setImagePreview(null)
			return
		}
		let next
		if (interaction.mode === 'move') {
			next = {
				...interaction.original,
				x: Math.min(Math.max(interaction.original.x + deltaX, 0), pageWidth - interaction.original.width),
				y: Math.min(Math.max(interaction.original.y + deltaY, 0), pageHeight - interaction.original.height),
			}
		} else {
			const scale = Math.max(0.1, 1 + Math.max(
				deltaX / interaction.original.width,
				-deltaY / interaction.original.height,
			))
			const width = Math.min(interaction.original.width * scale, pageWidth - interaction.original.x)
			const height = Math.min(interaction.original.height * (width / interaction.original.width), pageHeight - interaction.original.y)
			next = { ...interaction.original, width, height }
		}
		imageInteractionRef.current = null
		setImagePreview(null)
		onAnnotationEdit(next)
	}

	return (
		<article className={`prime-pdf-page${activeTool === 'draw' || activeTool === 'highlight' ? ' is-marking' : ''}`} ref={pageRef} aria-label={`PDF page ${pageNumber}`}>
			<canvas ref={canvasRef} className="prime-pdf-canvas" />
			<div className={`textLayer prime-pdf-text-layer ${editsEnabled ? 'is-editable' : ''}`} ref={textLayerRef} />
			<svg ref={svgRef} className={`prime-pdf-annotation-layer${['draw', 'highlight'].includes(activeTool) ? ' is-active' : ''}`} viewBox={viewport ? `0 0 ${viewport.width} ${viewport.height}` : undefined} aria-label={`Annotations on page ${pageNumber}`}>
				{viewport && annotations.filter((item) => item.pageNumber === pageNumber && ['highlight', 'draw', 'rectangle', 'ellipse'].includes(item.type)).map((item) => renderDrawing(item))}
				{viewport && annotations.filter((item) => item.pageNumber === pageNumber && item.type === 'image').map((item) => {
					const image = imagePreview?.id === item.id ? imagePreview : item
					const rect = imageRect(image)
					return (
						<div
							key={item.id}
							className="prime-pdf-image-object"
							role="group"
							aria-label="PDF image. Drag to move; drag the corner handle to resize."
							style={rect}
							onPointerDown={(event) => startImageInteraction(event, image)}
							onPointerMove={moveImageInteraction}
							onPointerUp={finishImageInteraction}
							onPointerCancel={finishImageInteraction}
						>
							<img src={item.dataUrl} alt="Added to PDF" draggable="false" />
							<button
								className="prime-pdf-image-delete"
								type="button"
								onPointerDown={(event) => event.stopPropagation()}
								onClick={() => onAnnotationDelete(item.id)}
								aria-label="Delete image"
							>×</button>
							<button
								className="prime-pdf-image-resize"
								type="button"
								data-image-resize
								onPointerDown={(event) => startImageInteraction(event, image)}
								onPointerMove={moveImageInteraction}
								onPointerUp={finishImageInteraction}
								onPointerCancel={finishImageInteraction}
								aria-label="Resize image"
							/>
						</div>
					)
				})}
				{drawingPreview && renderDrawing(drawingPreview, true)}
			</svg>
			{addedTexts.filter((item) => item.pageNumber === pageNumber).map((item) => (
				<div key={item.id} className="prime-pdf-added-text-wrap" style={{ left: viewport?.convertToViewportPoint(item.x, item.y)[0] ?? item.left, top: viewport?.convertToViewportPoint(item.x, item.y)[1] ?? item.top }}>
					{item.isEditing ? (
						<textarea
							data-added-text={item.id}
							className={`prime-pdf-added-text${item.annotationType === 'comment' ? ' is-comment' : ''}${item.annotationType === 'signature' ? ' is-signature' : ''}`}
							aria-label={item.annotationType === 'comment' ? 'PDF comment' : item.annotationType === 'signature' ? 'PDF signature' : 'Added PDF text'}
							dir="ltr"
							value={item.text}
							placeholder="Type text"
							onChange={(event) => onTextEdit({ ...item, text: event.target.value })}
							onKeyDown={(event) => {
								if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
									event.preventDefault()
									onTextCommit(item.id)
								}
							}}
							onFocus={(event) => {
								if (!item.selectOnFocus) return
								event.currentTarget.select()
								onTextEdit({ ...item, selectOnFocus: false })
							}}
							autoFocus
							style={{
								width: `${item.width * PAGE_SCALE * zoom}px`,
								minHeight: `${item.height * PAGE_SCALE * zoom}px`,
								fontSize: `${item.fontSize * PAGE_SCALE * zoom}px`,
							}}
						/>
					) : (
						<div
							className={`prime-pdf-added-text-display${item.annotationType === 'comment' ? ' is-comment' : ''}${item.annotationType === 'signature' ? ' is-signature' : ''}`}
							dir="ltr"
							style={{
								width: `${item.width * PAGE_SCALE * zoom}px`,
								minHeight: `${item.height * PAGE_SCALE * zoom}px`,
								fontSize: `${item.fontSize * PAGE_SCALE * zoom}px`,
							}}
						>{item.text}</div>
					)}
					<div className="prime-pdf-text-actions">
						{item.isEditing
							? <button type="button" onClick={() => onTextCommit(item.id)}>Done</button>
							: <button type="button" onClick={() => onTextEdit({ ...item, isEditing: true })}>Edit</button>}
						<button type="button" onClick={() => onTextDelete(item.id)}>Delete</button>
					</div>
				</div>
			))}
			{pageError && <p className="prime-pdf-page-error" role="alert">{pageError}</p>}
		</article>
	)
}

function PdfThumbnail({ document, pageNumber, active, onSelect }) {
	const buttonRef = useRef(null)
	const canvasRef = useRef(null)

	useEffect(() => {
		let isCurrent = true
		let renderTask
		const renderThumbnail = async () => {
			try {
				const page = await document.getPage(pageNumber)
				if (!isCurrent) return
				const scale = Math.min(0.18, 86 / Math.max(page.view[2], page.view[3]))
				const viewport = page.getViewport({ scale })
				const canvas = canvasRef.current
				const context = canvas?.getContext('2d', { alpha: false })
				if (!canvas || !context) return
				canvas.width = Math.ceil(viewport.width)
				canvas.height = Math.ceil(viewport.height)
				canvas.style.width = `${viewport.width}px`
				canvas.style.height = `${viewport.height}px`
				renderTask = page.render({ canvasContext: context, viewport })
				await renderTask.promise
			} catch {
				// Keep the page number link usable if thumbnail rendering is unsupported.
			}
		}
		const observer = typeof IntersectionObserver === 'undefined'
			? null
			: new IntersectionObserver((entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					observer.disconnect()
					renderThumbnail()
				}
			}, { rootMargin: '80px' })
		if (observer && buttonRef.current) observer.observe(buttonRef.current)
		else renderThumbnail()
		return () => {
			isCurrent = false
			observer?.disconnect()
			renderTask?.cancel()
		}
	}, [document, pageNumber])

	return (
		<button
			ref={buttonRef}
			className={`prime-pdf-thumbnail${active ? ' is-active' : ''}`}
			type="button"
			onClick={onSelect}
			aria-label={`Go to page ${pageNumber}`}
			aria-current={active ? 'page' : undefined}
		>
			<canvas ref={canvasRef} aria-hidden="true" />
			<span>Page {pageNumber}</span>
		</button>
	)
}

function PrimePdfEditor() {
	const location = useLocation()
	const navigate = useNavigate()
	const dashboardFileConsumedRef = useRef(false)
	const fileInputRef = useRef(null)
	const mergeInputRef = useRef(null)
	const imageInputRef = useRef(null)
	const [file, setFile] = useState(null)
	const [ownerEmail, setOwnerEmail] = useState('')
	const [editorSessionId, setEditorSessionId] = useState('')
	const [serverDocumentId, setServerDocumentId] = useState('')
	const [versionHistory, setVersionHistory] = useState([])
	const [showVersionHistory, setShowVersionHistory] = useState(false)
	const [isRestoring, setIsRestoring] = useState(true)
	const [hasPersistedDocument, setHasPersistedDocument] = useState(false)
	const [pdfjsLibrary, setPdfjsLibrary] = useState(null)
	const [pdfDocument, setPdfDocument] = useState(null)
	const [pdfBytes, setPdfBytes] = useState(null)
	const [pageCount, setPageCount] = useState(0)
	const [scannedPages, setScannedPages] = useState([])
	const [selectedTextProperties, setSelectedTextProperties] = useState(null)
	const [focusedPageNumber, setFocusedPageNumber] = useState(1)
	const [edits, setEdits] = useState({})
	const [addedTexts, setAddedTexts] = useState([])
	const [annotations, setAnnotations] = useState([])
	const [pageOrder, setPageOrder] = useState([])
	const [deletedPages, setDeletedPages] = useState([])
	const [pageRotations, setPageRotations] = useState({})
	const [activeTool, setActiveTool] = useState('')
	const [zoom, setZoom] = useState(1)
	const [pendingImage, setPendingImage] = useState(null)
	const [mergeFiles, setMergeFiles] = useState([])
	const [splitRange, setSplitRange] = useState('')
	const [notice, setNotice] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [subscriptionActive, setSubscriptionActive] = useState(false)
	const [subscriptionHasActivePlan, setSubscriptionHasActivePlan] = useState(false)
	const [subscriptionChecked, setSubscriptionChecked] = useState(false)
	const [subscriptionError, setSubscriptionError] = useState(false)
	const [ocrPageInProgress, setOcrPageInProgress] = useState(0)
	const [canUndo, setCanUndo] = useState(false)
	const [canRedo, setCanRedo] = useState(false)
	const [isSaved, setIsSaved] = useState(true)
	const [historyRestoreVersion, setHistoryRestoreVersion] = useState(0)
	const [restoredScrollTop, setRestoredScrollTop] = useState(null)
	const [pdfRenderGeneration, setPdfRenderGeneration] = useState(0)
	const [renderedPageKeys, setRenderedPageKeys] = useState([])
	const editsRef = useRef({})
	const addedTextsRef = useRef([])
	const annotationsRef = useRef([])
	const pageOrderRef = useRef([])
	const deletedPagesRef = useRef([])
	const pageRotationsRef = useRef({})
	const historyRef = useRef([{ edits: {}, addedTexts: [], annotations: [], pageOrder: [], deletedPages: [], pageRotations: {} }])
	const historyIndexRef = useRef(0)
	const pendingRestoredStateRef = useRef(null)
	const workspaceScrollTopRef = useRef(0)
	const scrollPersistTimerRef = useRef(null)
	const persistStateRef = useRef(null)
	const serverDocumentIdRef = useRef('')
	const onPageRendered = useCallback((renderKey) => {
		setRenderedPageKeys((current) => current.includes(renderKey) ? current : [...current, renderKey])
	}, [])
	const onScannedPage = useCallback((pageNumber, isScanned) => {
		setScannedPages((current) => {
			const includesPage = current.includes(pageNumber)
			if (isScanned && !includesPage) return [...current, pageNumber]
			if (!isScanned && includesPage) return current.filter((item) => item !== pageNumber)
			return current
		})
	}, [])
	const onTextSelect = useCallback((selection) => setSelectedTextProperties(selection), [])

	useEffect(() => {
		let isCurrent = true

		async function restoreEditorSession() {
			try {
				const sessionId = getPdfEditorSessionId()
				if (isCurrent) setEditorSessionId(sessionId)
				const { profile } = await getUserProfile()
				if (!isCurrent) return
				const email = profile.email?.trim().toLowerCase()
				if (!email) throw new Error('Your account email could not be verified for PDF session restore.')
				setOwnerEmail(email)
				const savedSession = await loadPdfEditorSession(sessionId, email)
				if (!isCurrent) return
				if (savedSession) {
					pendingRestoredStateRef.current = savedSession.state
					const restoredFile = new File(
						[savedSession.document.bytes],
						savedSession.document.name,
						{ type: 'application/pdf', lastModified: savedSession.document.lastModified },
					)
					setHasPersistedDocument(true)
					setIsLoading(true)
					setFile(restoredFile)
				}
			} catch (error) {
				if (isCurrent) setNotice(error.message || 'Could not restore your previous PDF editing session.')
			} finally {
				if (isCurrent) setIsRestoring(false)
			}
		}

		restoreEditorSession()
		return () => { isCurrent = false }
	}, [])

	useEffect(() => {
		if (restoredScrollTop === null || !pdfDocument) return undefined
		const visiblePageKeys = pageOrder
			.filter((pageIndex) => !deletedPages.includes(pageIndex))
			.map((pageIndex) => `${pdfRenderGeneration}:${pageIndex + 1}:${pageRotations[pageIndex] || 0}`)
		if (!visiblePageKeys.length || !visiblePageKeys.every((key) => renderedPageKeys.includes(key))) return undefined
		const frame = window.requestAnimationFrame(() => {
			const workspace = document.querySelector('.prime-pdf-workspace')
			if (workspace) workspace.scrollTop = restoredScrollTop
			setRestoredScrollTop(null)
		})
		return () => window.cancelAnimationFrame(frame)
	}, [deletedPages, pageOrder, pageRotations, pdfDocument, pdfRenderGeneration, renderedPageKeys, restoredScrollTop])

	useEffect(() => {
		function persistScrollPosition() {
			const workspace = document.querySelector('.prime-pdf-workspace')
			if (workspace) workspaceScrollTopRef.current = workspace.scrollTop
			if (scrollPersistTimerRef.current) window.clearTimeout(scrollPersistTimerRef.current)
			scrollPersistTimerRef.current = window.setTimeout(() => {
				persistStateRef.current?.()
			}, 300)
		}
		function persistBeforePageHide() {
			const workspace = document.querySelector('.prime-pdf-workspace')
			if (workspace) workspaceScrollTopRef.current = workspace.scrollTop
			persistStateRef.current?.()
		}
		document.addEventListener('scroll', persistScrollPosition, true)
		window.addEventListener('pagehide', persistBeforePageHide)
		return () => {
			document.removeEventListener('scroll', persistScrollPosition, true)
			window.removeEventListener('pagehide', persistBeforePageHide)
			if (scrollPersistTimerRef.current) window.clearTimeout(scrollPersistTimerRef.current)
		}
	}, [])

	useEffect(() => {
		let isCurrent = true
		getUserSubscription({ refresh: true })
			.then(({ subscription }) => {
				if (!isCurrent) return
				setSubscriptionHasActivePlan(subscription.active)
				setSubscriptionActive(subscription.active && subscription.featureKeys?.includes('pdf_editor'))
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

	function getPdfAccessMessage() {
		return subscriptionHasActivePlan
			? 'Your active plan does not include PDF editor downloads.'
			: 'An active plan with PDF editor downloads enabled is required.'
	}

	async function refreshSubscription() {
		setSubscriptionChecked(false)
		setSubscriptionError(false)
		try {
			const { subscription } = await getUserSubscription({ refresh: true })
			setSubscriptionHasActivePlan(subscription.active)
			setSubscriptionActive(subscription.active && subscription.featureKeys?.includes('pdf_editor'))
			setNotice('')
		} catch (error) {
			setSubscriptionHasActivePlan(false)
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
				setRenderedPageKeys([])
				setPdfRenderGeneration((generation) => generation + 1)
				setPdfBytes(bytes)
				setPageCount(loadedDocument.numPages)
				setScannedPages([])
				const initialOrder = Array.from({ length: loadedDocument.numPages }, (_, index) => index)
				const savedState = pendingRestoredStateRef.current
				pendingRestoredStateRef.current = null
				serverDocumentIdRef.current = savedState?.serverDocumentId || ''
				setServerDocumentId(serverDocumentIdRef.current)
				const restoredOrder = savedState?.pageOrder?.length === loadedDocument.numPages
					? savedState.pageOrder
					: initialOrder
				const initialSnapshot = {
					edits: savedState?.edits || {},
					addedTexts: savedState?.addedTexts || [],
					annotations: savedState?.annotations || [],
					pageOrder: restoredOrder,
					deletedPages: savedState?.deletedPages || [],
					pageRotations: savedState?.pageRotations || {},
				}
				const restoredHistory = Array.isArray(savedState?.history) && savedState.history.length
					? savedState.history
					: [initialSnapshot]
				const restoredHistoryIndex = Math.min(
					Math.max(Number(savedState?.historyIndex) || 0, 0),
					restoredHistory.length - 1,
				)
				const restoredSnapshot = restoredHistory[restoredHistoryIndex] || initialSnapshot
				editsRef.current = restoredSnapshot.edits
				addedTextsRef.current = restoredSnapshot.addedTexts
				annotationsRef.current = restoredSnapshot.annotations
				pageOrderRef.current = restoredSnapshot.pageOrder
				deletedPagesRef.current = restoredSnapshot.deletedPages
				pageRotationsRef.current = restoredSnapshot.pageRotations
				setEdits(restoredSnapshot.edits)
				setAddedTexts(restoredSnapshot.addedTexts)
				setAnnotations(restoredSnapshot.annotations)
				setPageOrder(restoredSnapshot.pageOrder)
				setDeletedPages(restoredSnapshot.deletedPages)
				setPageRotations(restoredSnapshot.pageRotations)
				historyRef.current = restoredHistory
				historyIndexRef.current = restoredHistoryIndex
				setCanUndo(restoredHistoryIndex > 0)
				setCanRedo(restoredHistoryIndex < restoredHistory.length - 1)
				setIsSaved(savedState?.isSaved ?? true)
				setActiveTool(savedState?.activeTool || '')
				setPendingImage(savedState?.pendingImage || null)
				setMergeFiles(savedState?.mergeFiles || [])
				setSplitRange(savedState?.splitRange || '')
				if (Number.isFinite(savedState?.scrollTop)) {
					workspaceScrollTopRef.current = savedState.scrollTop
					setRestoredScrollTop(savedState.scrollTop)
				}
				setHasPersistedDocument(Boolean(savedState))
				if (savedState) setHistoryRestoreVersion((version) => version + 1)
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

	useEffect(() => {
		if (!file || !pdfBytes || isLoading || isRestoring || !editorSessionId || !ownerEmail || hasPersistedDocument) return undefined
		let isCurrent = true
		savePdfEditorDocument(editorSessionId, ownerEmail, file, pdfBytes)
			.then(() => {
				if (isCurrent) setHasPersistedDocument(true)
			})
			.catch((error) => {
				if (isCurrent) setNotice(`Could not preserve this PDF for this session: ${error.message}`)
			})
		return () => { isCurrent = false }
	}, [editorSessionId, file, hasPersistedDocument, isLoading, isRestoring, ownerEmail, pdfBytes])

	useEffect(() => {
		persistStateRef.current = async () => {
			if (!file || !pdfBytes || !hasPersistedDocument || !editorSessionId || !ownerEmail) return
			try {
				await savePdfEditorState(editorSessionId, ownerEmail, {
					name: file.name,
					serverDocumentId,
					edits: editsRef.current,
					addedTexts: addedTextsRef.current,
					annotations: annotationsRef.current,
					pageOrder: pageOrderRef.current,
					deletedPages: deletedPagesRef.current,
					pageRotations: pageRotationsRef.current,
					history: historyRef.current,
					historyIndex: historyIndexRef.current,
					isSaved,
					activeTool,
					pendingImage,
					mergeFiles,
					splitRange,
					scrollTop: workspaceScrollTopRef.current,
				})
			} catch (error) {
				setNotice(`Could not preserve your PDF editing session: ${error.message}`)
			}
		}
	}, [activeTool, editorSessionId, file, hasPersistedDocument, isSaved, mergeFiles, ownerEmail, pendingImage, pdfBytes, serverDocumentId, splitRange])

	useEffect(() => {
		if (!file || !pdfBytes || !hasPersistedDocument || isLoading || isRestoring || !editorSessionId || !ownerEmail) return undefined
		const timer = window.setTimeout(() => persistStateRef.current?.(), 300)
		return () => window.clearTimeout(timer)
	}, [
		activeTool,
		addedTexts,
		annotations,
		deletedPages,
		edits,
		editorSessionId,
		file,
		hasPersistedDocument,
		historyRestoreVersion,
		isLoading,
		isRestoring,
		isSaved,
		mergeFiles,
		ownerEmail,
		pageOrder,
		pageRotations,
		pendingImage,
		pdfBytes,
		splitRange,
	])

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
		if (edit.id) {
			const nextAddedTexts = addedTextsRef.current.map((item) => item.id === edit.id ? edit : item)
			addedTextsRef.current = nextAddedTexts
			setAddedTexts(nextAddedTexts)
			const history = [...historyRef.current]
			history[historyIndexRef.current] = {
				...history[historyIndexRef.current],
				addedTexts: nextAddedTexts,
			}
			historyRef.current = history
			setIsSaved(false)
			return
		}
		if (edit.type === 'add') {
			recordChange(editsRef.current, [...addedTextsRef.current, { ...edit, id: crypto.randomUUID() }])
			setActiveTool('')
			setNotice(`${edit.annotationType === 'comment' ? 'Comment' : edit.annotationType === 'signature' ? 'Signature' : 'Text box'} added. Save / download to apply it to the PDF.`)
			return
		}

		const key = `${edit.pageNumber}:${edit.itemIndex}`
		recordChange({ ...editsRef.current, [key]: edit }, addedTextsRef.current)
	}, [recordChange])

	const cancelTextEdit = useCallback(({ pageNumber, itemIndex }) => {
		const key = `${pageNumber}:${itemIndex}`
		if (!Object.hasOwn(editsRef.current, key)) return
		const nextEdits = { ...editsRef.current }
		delete nextEdits[key]
		recordChange(nextEdits, addedTextsRef.current)
		setNotice('Text edit cancelled.')
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

	const commitAddedText = useCallback((id) => {
		const nextAddedTexts = addedTextsRef.current.map((item) => (
			item.id === id ? { ...item, isEditing: false, selectOnFocus: false } : item
		))
		recordChange(editsRef.current, nextAddedTexts)
		setNotice('Text added. Save or download the PDF to apply it.')
	}, [recordChange])

	const deleteAddedText = useCallback((id) => {
		recordChange(
			editsRef.current,
			addedTextsRef.current.filter((item) => item.id !== id),
		)
		setNotice('Text box deleted.')
	}, [recordChange])

	const updateAnnotation = useCallback((annotation) => {
		recordChange(
			editsRef.current,
			addedTextsRef.current,
			annotationsRef.current.map((item) => item.id === annotation.id ? annotation : item),
		)
	}, [recordChange])

	const deleteAnnotation = useCallback((id) => {
		recordChange(
			editsRef.current,
			addedTextsRef.current,
			annotationsRef.current.filter((item) => item.id !== id),
		)
		setNotice('Image deleted.')
	}, [recordChange])

	function updateSelectedTextProperty(property, value) {
		if (!selectedTextProperties) return
		const key = `${selectedTextProperties.pageNumber}:${selectedTextProperties.itemIndex}`
		const current = editsRef.current[key] || {
			...selectedTextProperties,
			replacementText: selectedTextProperties.originalText,
		}
		const updated = { ...current, [property]: value }
		recordChange({ ...editsRef.current, [key]: updated }, addedTextsRef.current)
		setSelectedTextProperties((selection) => ({ ...selection, [property]: value }))
		const textElement = document.querySelector(`[data-pdf-text-key="${key}"]`)
		if (textElement) {
			if (property === 'fontSize') textElement.style.fontSize = `${value * PAGE_SCALE * zoom}px`
			if (property === 'fontFamily') textElement.style.fontFamily = value
			if (property === 'color') textElement.style.color = value
			if (property === 'fontWeight') textElement.style.fontWeight = value
			if (property === 'italic') textElement.style.fontStyle = value ? 'italic' : 'normal'
			if (property === 'alignment') textElement.style.textAlign = value
			const patch = textElement.dataset.pdfPatch ? JSON.parse(textElement.dataset.pdfPatch) : {}
			textElement.dataset.pdfPatch = JSON.stringify({ ...patch, [property]: value })
		}
	}

	const placeImage = useCallback(async (position) => {
		if (!pendingImage || !pdfDocument) {
			setNotice('Choose a PNG or JPEG image before placing it.')
			setActiveTool('')
			return
		}
		try {
			const page = await pdfDocument.getPage(position.pageNumber)
			const pageViewport = page.getViewport({ scale: 1 })
			const pageWidth = pageViewport.width
			const pageHeight = pageViewport.height
			const aspectRatio = pendingImage.width / pendingImage.height
			const width = Math.min(
				180 / PAGE_SCALE,
				Math.max(pageWidth - position.x, 1),
				Math.max((pageHeight - position.y) * aspectRatio, 1),
			)
			const height = width / aspectRatio
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

	async function recognizeScannedPage(pageNumber) {
		if (!pdfDocument || !subscriptionActive || isSaving) return
		let worker
		let canvas
		setOcrPageInProgress(pageNumber)
		setNotice(`Recognizing text on page ${pageNumber}…`)
		try {
			const page = await pdfDocument.getPage(pageNumber)
			const scale = Math.min(2, 2400 / Math.max(page.view[2], page.view[3]))
			const rotation = (page.rotate + (pageRotations[pageNumber - 1] || 0)) % 360
			const viewport = page.getViewport({ scale, rotation })
			canvas = document.createElement('canvas')
			canvas.width = Math.ceil(viewport.width)
			canvas.height = Math.ceil(viewport.height)
			await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
			const { createWorker } = await import('tesseract.js')
			worker = await createWorker('eng')
			const { data } = await worker.recognize(canvas)
			const items = (data.lines || []).filter((line) => line.text?.trim() && line.confidence >= 25).slice(0, 500)
			if (!items.length) throw new Error('OCR did not find readable text on this page.')
			const recognized = items.map((line) => {
				const topLeft = viewport.convertToPdfPoint(line.bbox.x0, line.bbox.y0)
				const bottomRight = viewport.convertToPdfPoint(line.bbox.x1, line.bbox.y1)
				const left = Math.min(topLeft[0], bottomRight[0])
				const bottom = Math.min(topLeft[1], bottomRight[1])
				const top = Math.max(topLeft[1], bottomRight[1])
				const height = Math.max(top - bottom, 6)
				return {
					id: crypto.randomUUID(),
					pageNumber,
					x: left,
					y: top,
					width: Math.max(Math.abs(bottomRight[0] - topLeft[0]), 12),
					height,
					text: line.text.trim().slice(0, 1200),
					fontSize: Math.max(6, Math.min(48, height * 0.7)),
					fontFamily: 'Arial',
					color: '#171c19',
					annotationType: 'ocr',
					isEditing: false,
					ocrLine: true,
				}
			})
			recordChange(editsRef.current, [...addedTextsRef.current, ...recognized])
			setNotice(`Recognized ${recognized.length} text lines. Review and correct them before saving; OCR reconstruction is approximate.`)
		} catch (error) {
			setNotice(error.message || 'OCR could not read this page.')
		} finally {
			await worker?.terminate().catch(() => undefined)
			if (canvas) {
				canvas.width = 0
				canvas.height = 0
			}
			setOcrPageInProgress(0)
		}
	}

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
			textElement.style.minWidth = edit ? `${textElement.dataset.pdfOriginalWidth || textElement.offsetWidth}px` : ''
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
			if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return
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
		if (isLoading || isSaving || isRestoring) return
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
		serverDocumentIdRef.current = ''
		setServerDocumentId('')
		setVersionHistory([])
		setHasPersistedDocument(false)
		setRestoredScrollTop(null)
		workspaceScrollTopRef.current = 0
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

	useEffect(() => {
		const dashboardFile = location.state?.dashboardFile
		if (!dashboardFile || isRestoring || dashboardFileConsumedRef.current) return
		dashboardFileConsumedRef.current = true
		openFile(dashboardFile)
		navigate(location.pathname, { replace: true, state: null })
		// openFile is a local event handler; only run it when the route handoff or restore state changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location.pathname, location.state, isRestoring, navigate])

	function downloadBytes(bytes, name) {
		const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
		const link = document.createElement('a')
		link.href = url
		link.download = name
		link.click()
		setTimeout(() => URL.revokeObjectURL(url), 0)
	}

	async function ensureServerDocument() {
		if (serverDocumentIdRef.current) {
			try {
				const [documentResult, versionsResult] = await Promise.all([
					getPdfEditorDocument(serverDocumentIdRef.current),
					getPdfEditorVersions(serverDocumentIdRef.current),
				])
				setVersionHistory(versionsResult.versions || documentResult.document.versions || [])
				return serverDocumentIdRef.current
			} catch (error) {
				if (error.status !== 404) throw error
				serverDocumentIdRef.current = ''
				setServerDocumentId('')
			}
		}
		const { document: serverDocument } = await uploadPdfEditorDocument(file)
		serverDocumentIdRef.current = serverDocument.id
		setServerDocumentId(serverDocument.id)
		setVersionHistory(serverDocument.versions || [])
		return serverDocument.id
	}

	async function createServerEditedPdfBlob() {
		const documentId = await ensureServerDocument()
		const operations = {
			edits: Object.values(editsRef.current),
			addedTexts: addedTextsRef.current,
			annotations: annotationsRef.current,
			pageOrder: pageOrderRef.current,
			deletedPages: deletedPagesRef.current,
			pageRotations: pageRotationsRef.current,
		}
		try {
			await previewPdfEditorChanges(documentId, operations)
		} catch (error) {
			if (error.code !== 'PDF_EDIT_OVERLAP') throw error
			const overlapText = error.warnings.flatMap((warning) => warning.overlappingText || []).slice(0, 8).join(', ')
			const detail = overlapText ? ` Overlapping text: “${overlapText}”.` : ''
			if (!window.confirm(`The selected redaction area overlaps nearby page content.${detail} Continue and permanently remove all content in the selected area?`)) {
				return null
			}
			operations.confirmOverlap = true
			await previewPdfEditorChanges(documentId, operations)
		}
		const { document: savedDocument } = await applyPdfEditorChanges(documentId, operations)
		setVersionHistory(savedDocument.versions || [])
		return downloadPdfEditorVersion(documentId)
	}

	async function downloadPreviousVersion(version) {
		if (!serverDocumentIdRef.current) return
		setIsSaving(true)
		try {
			const blob = await downloadPdfEditorVersion(serverDocumentIdRef.current, version)
			downloadBytes(blob, `${file.name.replace(/\.pdf$/i, '')}-v${version}.pdf`)
			setNotice(`Downloaded PDF version ${version}.`)
		} catch (error) {
			setNotice(error.message || 'Could not download this PDF version.')
		} finally {
			setIsSaving(false)
		}
	}

	async function downloadEditedPdf() {
		if (!pdfBytes) return
		if (!subscriptionActive) {
			setNotice(getPdfAccessMessage())
			return
		}

		setIsSaving(true)
		setNotice('')
		try {
			const result = await createServerEditedPdfBlob()
			if (!result) {
				setNotice('The PDF changes were not saved.')
				return
			}
			downloadBytes(result, `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`)
			setIsSaved(true)
			setNotice('Edited PDF processed and saved as a new, downloadable version. Your original file was preserved.')
		} catch (error) {
			setNotice(error.message || 'Could not export the edited PDF.')
		} finally {
			setIsSaving(false)
		}
	}

	async function savePdf() {
		if (!pdfBytes) return
		if (!subscriptionActive) {
			setNotice(getPdfAccessMessage())
			return
		}

		setIsSaving(true)
		setNotice('')
		try {
			const editedBlob = await createServerEditedPdfBlob()
			if (!editedBlob) {
				setNotice('The PDF changes were not saved.')
				return
			}
			const bytes = await editedBlob.arrayBuffer()
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
				setNotice('Edited PDF processed and saved as a new, versioned document. Your original file was preserved.')
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
			setNotice(!subscriptionActive ? getPdfAccessMessage() : 'Choose at least one additional PDF to merge.')
			return
		}
		setIsSaving(true)
		setNotice('')
		try {
			const { PDFDocument } = await import('pdf-lib')
			const currentBlob = await createServerEditedPdfBlob()
			if (!currentBlob) {
				setNotice('The PDF changes were not saved.')
				return
			}
			const currentBytes = await currentBlob.arrayBuffer()
			const output = await PDFDocument.load(currentBytes)
			for (const mergeFile of mergeFiles) {
				const source = await PDFDocument.load(await mergeFile.arrayBuffer())
				const pages = await output.copyPages(source, source.getPageIndices())
				pages.forEach((page) => output.addPage(page))
			}
			downloadBytes(await output.save({ useObjectStreams: true }), `${file.name.replace(/\.pdf$/i, '')}-merged.pdf`)
			setIsSaved(true)
			setNotice(`Merged the edited document with ${mergeFiles.length} PDF file${mergeFiles.length === 1 ? '' : 's'}.`)
		} catch (error) {
			setNotice(error.message || 'Could not merge the selected PDFs.')
		} finally {
			setIsSaving(false)
		}
	}

	async function splitPdf() {
		if (!pdfBytes || !subscriptionActive) {
			setNotice(getPdfAccessMessage())
			return
		}
		setIsSaving(true)
		setNotice('')
		try {
			const { PDFDocument } = await import('pdf-lib')
			const currentBlob = await createServerEditedPdfBlob()
			if (!currentBlob) {
				setNotice('The PDF changes were not saved.')
				return
			}
			const currentBytes = await currentBlob.arrayBuffer()
			const source = await PDFDocument.load(currentBytes)
			const selectedPages = parsePageRange(splitRange, source.getPageCount())
			const output = await PDFDocument.create()
			const copiedPages = await output.copyPages(source, selectedPages)
			copiedPages.forEach((page) => output.addPage(page))
			downloadBytes(await output.save({ useObjectStreams: true }), `${file.name.replace(/\.pdf$/i, '')}-split.pdf`)
			setIsSaved(true)
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
		if (imageFile.size > 8 * 1024 * 1024) {
			setNotice('Choose an image smaller than 8 MB.')
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
		<main className="dashboard-layout prime-pdf-editor-page">
			<WorkspaceHeader active="editor" />
			<section className="dashboard-content">

				<div className="document-editor-main">
					<div className="document-editor-heading">
						<div>
							<p className="dashboard-eyebrow">YOUR DOCUMENT STUDIO</p>
							<h1>PDF editor</h1>
							<p className="prime-pdf-heading-copy">A calmer space to refine, annotate, and organize your documents.</p>
						</div>
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
									disabled={isLoading || isSaving || isRestoring}
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
									<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isSaving || isRestoring}>
										{isRestoring ? 'Restoring session…' : isLoading ? 'Opening document…' : 'Open PDF / DOCX'}
									</button>
								</div>
								{pdfDocument && (
									<>
										<div className="prime-pdf-tool-group" role="group" aria-label="History">
											<span className="prime-pdf-tool-group-label">History</span>
											<button className="editor-open-button" type="button" onClick={undoEdit} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
											<button className="editor-open-button" type="button" onClick={redoEdit} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
										</div>
										<div className="prime-pdf-tool-group" role="group" aria-label="Zoom">
											<span className="prime-pdf-tool-group-label">Zoom</span>
											<button className="editor-open-button" type="button" onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10))} disabled={zoom <= 0.5} aria-label="Zoom out">−</button>
											<span aria-live="polite">{Math.round(zoom * 100)}%</span>
											<button className="editor-open-button" type="button" onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10))} disabled={zoom >= 2} aria-label="Zoom in">+</button>
											<button className="editor-open-button" type="button" onClick={() => setZoom(1)}>Reset</button>
										</div>
										<div className="prime-pdf-tool-group prime-pdf-annotation-tools" role="group" aria-label="Add and annotate">
											<span className="prime-pdf-tool-group-label">Add & annotate</span>
										{[
											['erase', 'Redact text', 'Select text to remove it from the exported PDF.'],
											['text', 'Add text', 'Click a page to add text.'],
											['highlight', 'Highlight', 'Drag over a page to highlight an area.'],
											['draw', 'Draw', 'Draw on a page with your pointer or finger.'],
											['rectangle', 'Rectangle', 'Click a page to add a rectangle.'],
											['ellipse', 'Ellipse', 'Click a page to add an ellipse.'],
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
						<div className="prime-pdf-tool-group prime-pdf-version-group" role="group" aria-label="Document versions">
							<span className="prime-pdf-tool-group-label">Versions</span>
							<button className="editor-open-button" type="button" onClick={() => setShowVersionHistory((current) => !current)} aria-expanded={showVersionHistory} disabled={!versionHistory.length}>
								History ({versionHistory.length})
							</button>
							{showVersionHistory && <div className="prime-pdf-version-list">
								{[...versionHistory].reverse().map((version) => (
									<button key={version.version} type="button" onClick={() => downloadPreviousVersion(version.version)} disabled={isSaving}>
										<span>{version.original ? 'Original' : `Version ${version.version}`}{version.version === versionHistory[versionHistory.length - 1]?.version ? ' · Current' : ''}</span>
										<small>{new Date(version.createdAt).toLocaleString()}</small>
									</button>
								))}
							</div>}
						</div>
									</>
								)}
							</div>
						</div>

						{subscriptionChecked && !subscriptionActive && (
							<div className={`prime-pdf-access-notice${subscriptionError ? ' is-error' : ''}`} role={subscriptionError ? 'alert' : 'status'}>
								<span>{subscriptionError
									? 'Could not verify your PDF editing pass. Saving, merging, and splitting are unavailable until access is checked.'
									: getPdfAccessMessage()}</span>
								{subscriptionError
									? <button className="editor-open-button" type="button" onClick={refreshSubscription}>Retry check</button>
									: <Link to="/pricing">View PDF plans</Link>}
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
						<div className={`prime-pdf-editor-layout ${pdfDocument ? 'has-document' : 'is-empty'}`}>
						{pdfDocument && <aside className="prime-pdf-sidebar" aria-label="PDF tools and pages">
							<div className="prime-pdf-side-section">
								<h2><span>Tools</span><span className="prime-pdf-tool-hint">Choose one</span></h2>
								{[
									['', 'T', 'Edit text', 'Select text on the page to edit it.'],
									['erase', '⌫', 'Redact', 'Select text to redact it from the exported PDF.'],
									['text', '＋', 'Add text', 'Click a page to add text.'],
									['highlight', '▰', 'Highlight', 'Drag over a page to highlight an area.'],
									['draw', '✎', 'Draw', 'Draw on a page with your pointer or finger.'],
									['rectangle', '□', 'Rectangle', 'Click a page to place a rectangle.'],
									['ellipse', '○', 'Ellipse', 'Click a page to place an ellipse.'],
									['comment', '▤', 'Comment', 'Click a page to add a comment.'],
									['signature', '✍', 'Signature', 'Click a page to add a typed signature.'],
								].map(([tool, icon, label, message]) => (
									<button key={label} className={`prime-pdf-side-tool${(activeTool || '') === tool ? ' is-active' : ''}`} type="button" onClick={() => { setActiveTool(tool); setNotice(message) }} aria-pressed={(activeTool || '') === tool}>
										<span className="prime-pdf-side-tool-icon" aria-hidden="true">{icon}</span><span>{label}</span>
									</button>
								))}
								<button className="prime-pdf-side-tool" type="button" onClick={() => imageInputRef.current?.click()}><span className="prime-pdf-side-tool-icon" aria-hidden="true">▧</span><span>Add image</span></button>
							</div>
							<div className="prime-pdf-side-section prime-pdf-pages-panel">
								<h2>Pages <span>{pageOrder.filter((index) => !deletedPages.includes(index)).length}</span></h2>
								{pageOrder.filter((pageIndex) => !deletedPages.includes(pageIndex)).map((pageIndex) => (
									<PdfThumbnail
										key={`${file?.name}:${pageIndex + 1}`}
										document={pdfDocument}
										pageNumber={pageIndex + 1}
										active={focusedPageNumber === pageIndex + 1}
										onSelect={() => {
											setFocusedPageNumber(pageIndex + 1)
											document.getElementById(`prime-pdf-page-${pageIndex + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
										}}
									/>
								))}
							</div>
						</aside>}
						<div
							className={`prime-pdf-workspace ${activeTool ? `is-tool-${activeTool}` : ''}`}
							onDragOver={(event) => event.preventDefault()}
							onDrop={handleDrop}
						>
							{isRestoring && <p className="prime-pdf-loading">Checking for your previous PDF session…</p>}
							{isLoading && <p className="prime-pdf-loading">Opening PDF…</p>}
							{pdfDocument && pageOrder
								.filter((pageIndex) => !deletedPages.includes(pageIndex))
								.map((pageIndex, visibleIndex, visiblePages) => (
									<div className="prime-pdf-page-wrap" id={`prime-pdf-page-${pageIndex + 1}`} key={`${file.name}:${pageIndex + 1}`}>
										<div className="prime-pdf-page-controls" aria-label={`Controls for page ${pageIndex + 1}`}>
											<strong>Page {visibleIndex + 1} <span>of {visiblePages.length}</span></strong>
											{scannedPages.includes(pageIndex + 1) && <button className="editor-open-button" type="button" onClick={() => recognizeScannedPage(pageIndex + 1)} disabled={!subscriptionActive || isSaving || addedTexts.some((item) => item.ocrLine && item.pageNumber === pageIndex + 1)} title="Recognize text in this scanned page">{ocrPageInProgress === pageIndex + 1 ? 'Recognizing…' : addedTexts.some((item) => item.ocrLine && item.pageNumber === pageIndex + 1) ? 'OCR added' : 'OCR page'}</button>}
											<button className="editor-open-button" type="button" onClick={() => movePage(pageIndex, -1)} disabled={!visibleIndex}>Move up</button>
											<button className="editor-open-button" type="button" onClick={() => movePage(pageIndex, 1)} disabled={visibleIndex === visiblePages.length - 1}>Move down</button>
											<button className="editor-open-button" type="button" onClick={() => rotatePage(pageIndex)}>Rotate 90°</button>
											<button className="editor-open-button" type="button" onClick={() => deletePage(pageIndex)}>Delete page</button>
										</div>
										<PdfPage
											document={pdfDocument}
											pdfjsLibrary={pdfjsLibrary}
											zoom={zoom}
											pageNumber={pageIndex + 1}
											rotation={pageRotations[pageIndex] || 0}
											editsRef={editsRef}
											editsEnabled
											activeTool={activeTool}
											addedTexts={addedTexts}
											annotations={annotations}
											onTextEdit={recordEdit}
											onTextCancel={cancelTextEdit}
											onTextCommit={commitAddedText}
											onTextDelete={deleteAddedText}
											onAnnotation={recordAnnotation}
											onAnnotationEdit={updateAnnotation}
											onAnnotationDelete={deleteAnnotation}
											onImagePlace={placeImage}
											onPageRendered={onPageRendered}
							onScannedPage={onScannedPage}
							onTextSelect={onTextSelect}
											renderKey={`${pdfRenderGeneration}:${pageIndex + 1}:${pageRotations[pageIndex] || 0}`}
										/>
									</div>
								))}
							{!file && !isLoading && !isRestoring && (
								<div className="editor-empty-state">
									<span className="editor-empty-icon" aria-hidden="true">PDF</span>
									<h2>{hasPersistedDocument ? 'Restoring your PDF…' : 'Open a PDF to get started'}</h2>
									<p>Bring in a PDF or DOCX to start editing. Your file stays on this device while you work.</p>
									<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isRestoring}>Choose PDF</button>
									<div className="prime-pdf-welcome-details"><span><b>01</b> Add your document</span><span><b>02</b> Make it yours</span><span><b>03</b> Save when ready</span></div>
									<small className="prime-pdf-format-note">PDF and DOCX · up to 50 MB · processed in your browser</small>
								</div>
							)}
						</div>
							{pdfDocument && <aside className="prime-pdf-properties" aria-label="Text properties">
								<h2>Properties</h2>
								{selectedTextProperties ? <>
									<p className="prime-pdf-property-selection">Page {selectedTextProperties.pageNumber} · {selectedTextProperties.originalText.slice(0, 52)}{selectedTextProperties.originalText.length > 52 ? '…' : ''}</p>
									<label>Font size <output>{Math.round(selectedTextProperties.fontSize || 12)} pt</output>
										<input type="range" min="4" max="72" step="1" value={Math.max(4, Math.min(72, Math.round(selectedTextProperties.fontSize || 12)))} onChange={(event) => updateSelectedTextProperty('fontSize', Number(event.target.value))} />
									</label>
									<label>Font family
										<select value={/courier|mono/i.test(selectedTextProperties.fontFamily || '') ? 'Courier' : /times|serif/i.test(selectedTextProperties.fontFamily || '') ? 'Times New Roman' : 'Arial'} onChange={(event) => updateSelectedTextProperty('fontFamily', event.target.value)}>
											<option>Arial</option><option>Times New Roman</option><option>Courier</option>
										</select>
									</label>
									<label>Text color <input type="color" value={/^#[0-9a-f]{6}$/i.test(selectedTextProperties.color || '') ? selectedTextProperties.color : '#171c19'} onChange={(event) => updateSelectedTextProperty('color', event.target.value)} /></label>
									<div className="prime-pdf-property-toggles" aria-label="Text styles">
										<button className={Number(selectedTextProperties.fontWeight) >= 600 || selectedTextProperties.fontWeight === 'bold' ? 'is-active' : ''} type="button" aria-pressed={Number(selectedTextProperties.fontWeight) >= 600 || selectedTextProperties.fontWeight === 'bold'} onClick={() => updateSelectedTextProperty('fontWeight', Number(selectedTextProperties.fontWeight) >= 600 || selectedTextProperties.fontWeight === 'bold' ? '400' : '700')}>Bold</button>
										<button className={selectedTextProperties.italic ? 'is-active' : ''} type="button" aria-pressed={Boolean(selectedTextProperties.italic)} onClick={() => updateSelectedTextProperty('italic', !selectedTextProperties.italic)}>Italic</button>
									</div>
									<label>Alignment
										<select value={['left', 'center', 'right'].includes(selectedTextProperties.alignment) ? selectedTextProperties.alignment : 'left'} onChange={(event) => updateSelectedTextProperty('alignment', event.target.value)}>
											<option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
										</select>
									</label>
								</> : <p>Select a text block on the page to edit its font, size, color, and alignment.</p>}
							</aside>}
						</div>
					</section>
					<div className="document-editor-footer">
						<p>{pdfDocument
							? activeTool
											? `${activeTool[0].toUpperCase()}${activeTool.slice(1)} tool is active. ${activeTool === 'draw' || activeTool === 'highlight' ? 'Drag on a page to mark it.' : activeTool === 'erase' ? 'Click a text block to redact it from the exported PDF.' : 'Click a page to place it.'}`
								: editCount
									? `${editCount} unsaved change${editCount === 1 ? '' : 's'} · use the page controls, annotation tools, Undo / Redo, and Save / Download.`
									: 'Select PDF text to replace it. Use the toolbar to annotate, insert an image/signature/comment, or manage pages.'
							: subscriptionError
								? 'Could not verify your PDF editing pass. Retry the check above.'
								: subscriptionActive
									? 'Your original stays unchanged. Saving sends the PDF privately to the editor service, which creates a versioned export.'
									: subscriptionChecked
										? getPdfAccessMessage()
										: 'Checking PDF editing access…'}</p>
					</div>
					<p className="prime-pdf-disclaimer">Text replacement and redaction are applied to the PDF content server-side; removed text is not left behind as a white overlay. Embedded fonts and complex layouts may need a substitute font, and replacement text may wrap. OCR on scanned pages is approximate; review and correct each line before saving. DOCX conversion creates a visual PDF, so its original text is not editable.</p>
				</div>
			</section>
		</main>
	)
}

export default PrimePdfEditor
