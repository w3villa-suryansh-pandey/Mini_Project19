import { useRef, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'

const STICKERS = ['⭐', '✅', '📌', '💡', '🎉', '❤️', '📎', '🌱']

function WritingPad() {
	const editorRef = useRef(null)
	const imageInputRef = useRef(null)
	const signatureCanvasRef = useRef(null)
	const savedSelectionRef = useRef(null)
	const drawingRef = useRef(false)
	const [notice, setNotice] = useState('')
	const [isSignatureOpen, setIsSignatureOpen] = useState(false)
	const [signatureHasInk, setSignatureHasInk] = useState(false)

	function captureSelection() {
		const selection = window.getSelection()
		const editor = editorRef.current
		if (!selection?.rangeCount || !editor?.contains(selection.anchorNode)) return
		savedSelectionRef.current = selection.getRangeAt(0).cloneRange()
	}

	function restoreSelection() {
		const range = savedSelectionRef.current
		if (!range || !editorRef.current?.contains(range.commonAncestorContainer)) return
		const selection = window.getSelection()
		selection?.removeAllRanges()
		selection?.addRange(range)
		editorRef.current.focus()
	}

	function runCommand(command, value = null) {
		restoreSelection()
		document.execCommand(command, false, value)
		captureSelection()
		editorRef.current?.focus()
	}

	function setBlockStyle(tagName) {
		runCommand('formatBlock', `<${tagName}>`)
	}

	function setFontSize(size) {
		restoreSelection()
		document.execCommand('fontSize', false, '7')
		editorRef.current?.querySelectorAll('font[size="7"]').forEach((font) => {
			const span = document.createElement('span')
			span.style.fontSize = `${size}px`
			span.innerHTML = font.innerHTML
			font.replaceWith(span)
		})
		captureSelection()
		editorRef.current?.focus()
	}

	function insertImage(event) {
		const imageFile = event.target.files?.[0]
		event.target.value = ''
		if (!imageFile) return
		if (!imageFile.type.startsWith('image/')) {
			setNotice('Choose a supported image file.')
			return
		}
		if (imageFile.size > 10 * 1024 * 1024) {
			setNotice('Choose an image smaller than 10 MB.')
			return
		}
		const reader = new FileReader()
		reader.onload = () => {
			restoreSelection()
			const image = document.createElement('img')
			image.src = String(reader.result)
			image.alt = imageFile.name
			image.style.maxWidth = '100%'
			image.style.height = 'auto'
			image.style.display = 'block'
			image.style.margin = '14px 0'
			const selection = window.getSelection()
			if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
				const range = selection.getRangeAt(0)
				range.deleteContents()
				range.insertNode(image)
				range.setStartAfter(image)
				range.collapse(true)
				selection.removeAllRanges()
				selection.addRange(range)
			} else {
				editorRef.current?.append(image)
			}
			editorRef.current?.focus()
			setNotice('Image added to your writing pad.')
		}
		reader.onerror = () => setNotice('The selected image could not be read.')
		reader.readAsDataURL(imageFile)
	}

	function insertSticker(sticker) {
		runCommand('insertHTML', `<span aria-label="Sticker" style="font-size:30px;vertical-align:middle">${sticker}</span>&nbsp;`)
		setNotice('Sticker added.')
	}

	function getCanvasPoint(event) {
		const canvas = signatureCanvasRef.current
		const bounds = canvas.getBoundingClientRect()
		return {
			x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
			y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
		}
	}

	function startSignature(event) {
		const canvas = signatureCanvasRef.current
		const context = canvas?.getContext('2d')
		if (!canvas || !context) return
		event.preventDefault()
		canvas.setPointerCapture(event.pointerId)
		const point = getCanvasPoint(event)
		context.beginPath()
		context.moveTo(point.x, point.y)
		context.lineWidth = 3
		context.lineCap = 'round'
		context.lineJoin = 'round'
		context.strokeStyle = '#263d33'
		drawingRef.current = true
	}

	function drawSignature(event) {
		if (!drawingRef.current) return
		const context = signatureCanvasRef.current?.getContext('2d')
		if (!context) return
		const point = getCanvasPoint(event)
		context.lineTo(point.x, point.y)
		context.stroke()
		setSignatureHasInk(true)
	}

	function endSignature() {
		drawingRef.current = false
	}

	function clearSignature() {
		const canvas = signatureCanvasRef.current
		const context = canvas?.getContext('2d')
		if (!canvas || !context) return
		context.clearRect(0, 0, canvas.width, canvas.height)
		setSignatureHasInk(false)
	}

	function insertSignature() {
		const canvas = signatureCanvasRef.current
		if (!canvas || !signatureHasInk) return
		const signature = document.createElement('img')
		signature.src = canvas.toDataURL('image/png')
		signature.alt = 'Hand-drawn signature'
		signature.style.width = '240px'
		signature.style.maxWidth = '100%'
		signature.style.height = 'auto'
		signature.style.display = 'block'
		signature.style.margin = '12px 0'
		restoreSelection()
		const selection = window.getSelection()
		if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
			const range = selection.getRangeAt(0)
			range.deleteContents()
			range.insertNode(signature)
			range.setStartAfter(signature)
			range.collapse(true)
			selection.removeAllRanges()
			selection.addRange(range)
		} else {
			editorRef.current?.append(signature)
		}
		editorRef.current?.focus()
		setIsSignatureOpen(false)
		setSignatureHasInk(false)
		setNotice('Signature added to your writing pad.')
	}

	function downloadWriting() {
		const content = editorRef.current?.innerHTML
		if (!content || content === '<p><br></p>') {
			setNotice('Add some content before downloading your writing.')
			return
		}
		const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Writing Pad document</title><style>body{max-width:800px;margin:48px auto;padding:0 24px;color:#263a31;font:16px/1.7 Arial,sans-serif}img{max-width:100%;height:auto}blockquote{border-left:3px solid #78a08a;margin-left:0;padding-left:16px;color:#536158}@media print{body{margin:0 auto}}</style></head><body>${content}</body></html>`
		const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
		const link = document.createElement('a')
		link.href = url
		link.download = 'writing-pad.html'
		link.click()
		setTimeout(() => URL.revokeObjectURL(url), 0)
		setNotice('Your writing was downloaded as an HTML document.')
	}

	return (
		<main className="dashboard-layout">
			<Sidebar active="writing-pad" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> Writing pad</div>
					<a className="dashboard-account-link" href="/profile">
						<span className="dashboard-account-avatar" aria-hidden="true">W</span>
						<span>My account</span>
					</a>
				</header>

				<div className="document-editor-main">
					<div className="document-editor-heading">
						<div>
							<p className="dashboard-eyebrow">YOUR PRIVATE WORKSPACE</p>
							<h1>Writing pad</h1>
						</div>
						<span className="compressor-local-status"><span />WRITING STAYS IN YOUR BROWSER</span>
					</div>

					<section className="writing-pad-shell" aria-label="Writing pad editor">
						<div className="writing-pad-toolbar" aria-label="Text formatting tools">
							<div className="writing-pad-tool-group">
								<label className="writing-pad-select-label">
									<span className="writing-pad-visually-hidden">Text style</span>
									<select defaultValue="p" onChange={(event) => setBlockStyle(event.target.value)} onMouseDown={captureSelection}>
										<option value="p">Paragraph</option>
										<option value="h1">Heading 1</option>
										<option value="h2">Heading 2</option>
										<option value="h3">Heading 3</option>
										<option value="blockquote">Quote</option>
									</select>
								</label>
								<label className="writing-pad-select-label">
									<span className="writing-pad-visually-hidden">Font size</span>
									<select defaultValue="16" onChange={(event) => setFontSize(Number(event.target.value))} onMouseDown={captureSelection}>
										<option value="12">12 px</option>
										<option value="14">14 px</option>
										<option value="16">16 px</option>
										<option value="18">18 px</option>
										<option value="24">24 px</option>
										<option value="32">32 px</option>
										<option value="40">40 px</option>
									</select>
								</label>
							</div>
							<div className="writing-pad-tool-group" aria-label="Text style">
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')} aria-label="Bold" title="Bold"><strong>B</strong></button>
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('italic')} aria-label="Italic" title="Italic"><em>I</em></button>
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('underline')} aria-label="Underline" title="Underline"><u>U</u></button>
								<label className="writing-pad-color" title="Text color">
									<span>A</span>
									<input type="color" defaultValue="#263a31" aria-label="Text color" onMouseDown={captureSelection} onChange={(event) => runCommand('foreColor', event.target.value)} />
								</label>
							</div>
							<div className="writing-pad-tool-group" aria-label="Text alignment">
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('justifyLeft')} aria-label="Align left" title="Align left">⇤</button>
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('justifyCenter')} aria-label="Align center" title="Align center">↔</button>
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('justifyRight')} aria-label="Align right" title="Align right">⇥</button>
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')} aria-label="Bulleted list" title="Bulleted list">• List</button>
							</div>
							<div className="writing-pad-tool-group writing-pad-insert-tools">
								<input ref={imageInputRef} className="editor-file-input" type="file" accept="image/*" onChange={insertImage} aria-label="Choose image or logo" />
								<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => imageInputRef.current?.click()}>Image / logo</button>
								<button type="button" onMouseDown={captureSelection} onClick={() => setIsSignatureOpen(true)}>Signature</button>
							</div>
						</div>

						<div className="writing-pad-stickers" aria-label="Insert a sticker">
							<span>Stickers</span>
							{STICKERS.map((sticker) => (
								<button key={sticker} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertSticker(sticker)} aria-label={`Insert ${sticker}`}>
									{sticker}
								</button>
							))}
						</div>

						<div
							ref={editorRef}
							className="writing-pad-editor"
							contentEditable
							suppressContentEditableWarning
							role="textbox"
							aria-label="Write your document"
							aria-multiline="true"
							data-placeholder="Start writing here…"
							onMouseUp={captureSelection}
							onKeyUp={captureSelection}
							onInput={() => setNotice('')}
						>
							<h1>Untitled document</h1>
							<p><br /></p>
						</div>

						<footer className="writing-pad-footer">
							<p aria-live="polite">{notice || 'Format your text, add images or stickers, and insert a signature. Your work stays in this browser.'}</p>
							<div>
								<button type="button" className="editor-open-button" onClick={() => window.print()}>Print / Save as PDF</button>
								<button type="button" className="editor-open-button editor-save-button" onClick={downloadWriting}>Download document</button>
							</div>
						</footer>
					</section>
				</div>
			</section>

			{isSignatureOpen && (
				<div className="writing-signature-backdrop" role="presentation" onMouseDown={(event) => {
					if (event.target === event.currentTarget) setIsSignatureOpen(false)
				}}>
					<section className="writing-signature-dialog" role="dialog" aria-modal="true" aria-labelledby="writing-signature-title">
						<div>
							<p className="dashboard-eyebrow">SIGNATURE</p>
							<h2 id="writing-signature-title">Draw your signature</h2>
						</div>
						<canvas
							ref={signatureCanvasRef}
							className="writing-signature-canvas"
							width="640"
							height="200"
							aria-label="Draw signature in this area"
							onPointerDown={startSignature}
							onPointerMove={drawSignature}
							onPointerUp={endSignature}
							onPointerCancel={endSignature}
						/>
						<div className="writing-signature-actions">
							<button className="editor-open-button" type="button" onClick={clearSignature}>Clear</button>
							<button className="editor-open-button" type="button" onClick={() => setIsSignatureOpen(false)}>Cancel</button>
							<button className="editor-open-button editor-save-button" type="button" onClick={insertSignature} disabled={!signatureHasInk}>Insert signature</button>
						</div>
					</section>
				</div>
			)}
		</main>
	)
}

export default WritingPad
