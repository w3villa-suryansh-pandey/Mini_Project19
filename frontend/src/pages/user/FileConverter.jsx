import { useEffect, useRef, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import { convertDocxToPdf } from '../../utils/docxToPdf.js'

const MAX_FILE_SIZE = 100 * 1024 * 1024
const MAX_IMAGE_PIXELS = 25 * 1000 * 1000
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/bmp,image/svg+xml,.jpg,.jpeg,.png,.webp,.bmp,.svg'
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|bmp|svg)$/i
const DOCX_EXTENSIONS = /\.docx$/i
const CONVERSION_MODES = [
	{ id: 'images-to-pdf', label: 'Images to PDF', description: 'Combine images into a PDF' },
	{ id: 'pdf-to-images', label: 'PDF to images', description: 'Save each PDF page as an image' },
	{ id: 'image-format', label: 'Image format', description: 'Convert images to JPG, PNG, or WebP' },
	{ id: 'docx-to-pdf', label: 'DOCX to PDF', description: 'Convert Word documents to visual PDFs' },
]
const IMAGE_FORMATS = {
	jpg: { mime: 'image/jpeg', extension: 'jpg' },
	png: { mime: 'image/png', extension: 'png' },
	webp: { mime: 'image/webp', extension: 'webp' },
}

function formatFileSize(size) {
	if (size < 1024) return `${size} B`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
	return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function baseName(fileName) {
	return fileName.replace(/\.[^.]+$/, '') || 'converted-file'
}

function isSupportedImage(file) {
	return IMAGE_EXTENSIONS.test(file.name) && (
		!file.type
		|| ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/svg+xml'].includes(file.type)
	)
}

function createImage(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file)
		const image = new Image()
		image.onload = () => {
			URL.revokeObjectURL(url)
			resolve(image)
		}
		image.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error(`Could not open "${file.name}". Try a different image file.`))
		}
		image.src = url
	})
}

function canvasToBlob(canvas, mimeType, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob)
			else reject(new Error('Your browser could not create the converted image.'))
		}, mimeType, quality)
	})
}

async function loadPdfJs() {
	const pdfjs = await import('pdfjs-dist')
	pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
	return pdfjs
}

async function convertImagesToPdf(files) {
	const { PDFDocument } = await import('pdf-lib')
	const pdf = await PDFDocument.create()

	for (const file of files) {
		const image = await createImage(file)
		if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
			throw new Error(`"${file.name}" is too large to convert safely in this browser. Choose an image with 25 megapixels or fewer.`)
		}
		const canvas = document.createElement('canvas')
		canvas.width = image.naturalWidth
		canvas.height = image.naturalHeight
		const context = canvas.getContext('2d', { alpha: false })
		if (!context) throw new Error('Your browser could not prepare an image for PDF conversion.')
		context.fillStyle = '#ffffff'
		context.fillRect(0, 0, canvas.width, canvas.height)
		context.drawImage(image, 0, 0)
		const imageBytes = await canvasToBlob(canvas, 'image/png')
			.then((blob) => blob.arrayBuffer())
		const embeddedImage = await pdf.embedPng(imageBytes)
		const page = pdf.addPage([embeddedImage.width, embeddedImage.height])
		page.drawImage(embeddedImage, {
			x: 0,
			y: 0,
			width: embeddedImage.width,
			height: embeddedImage.height,
		})
		canvas.width = 0
		canvas.height = 0
	}

	const bytes = await pdf.save({ useObjectStreams: true })
	return [{
		name: `${baseName(files[0].name)}${files.length > 1 ? '-combined' : ''}.pdf`,
		blob: new Blob([bytes], { type: 'application/pdf' }),
	}]
}

async function convertPdfToImages(file, format, quality) {
	const pdfjs = await loadPdfJs()
	const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
	const output = []
	const imageFormat = IMAGE_FORMATS[format]
	let pdf

	try {
		pdf = await loadingTask.promise
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber)
			const baseViewport = page.getViewport({ scale: 1 })
			const scale = Math.min(2, 1800 / Math.max(baseViewport.width, baseViewport.height))
			const viewport = page.getViewport({ scale })
			const canvas = document.createElement('canvas')
			canvas.width = Math.ceil(viewport.width)
			canvas.height = Math.ceil(viewport.height)
			const context = canvas.getContext('2d', { alpha: format !== 'jpg' })
			if (!context) throw new Error(`Your browser could not prepare page ${pageNumber} for conversion.`)
			if (format === 'jpg') {
				context.fillStyle = '#ffffff'
				context.fillRect(0, 0, canvas.width, canvas.height)
			}
			await page.render({ canvasContext: context, viewport }).promise
			const blob = await canvasToBlob(canvas, imageFormat.mime, quality)
			output.push({
				name: `${baseName(file.name)}-page-${String(pageNumber).padStart(3, '0')}.${imageFormat.extension}`,
				blob,
			})
			canvas.width = 0
			canvas.height = 0
			page.cleanup()
		}
	} finally {
		if (pdf) await pdf.destroy()
		else await loadingTask.destroy()
	}

	return output
}

async function convertImageFormats(files, format, quality) {
	const imageFormat = IMAGE_FORMATS[format]
	const output = []
	for (const file of files) {
		const image = await createImage(file)
		if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
			throw new Error(`"${file.name}" is too large to convert safely in this browser. Choose an image with 25 megapixels or fewer.`)
		}
		const canvas = document.createElement('canvas')
		canvas.width = image.naturalWidth
		canvas.height = image.naturalHeight
		const context = canvas.getContext('2d', { alpha: format !== 'jpg' })
		if (!context) throw new Error(`Your browser could not prepare "${file.name}" for conversion.`)
		if (format === 'jpg') {
			context.fillStyle = '#ffffff'
			context.fillRect(0, 0, canvas.width, canvas.height)
		}
		context.drawImage(image, 0, 0)
		output.push({
			name: `${baseName(file.name)}.${imageFormat.extension}`,
			blob: await canvasToBlob(canvas, imageFormat.mime, quality),
		})
		canvas.width = 0
		canvas.height = 0
	}
	return output
}

function FileConverter() {
	const fileInputRef = useRef(null)
	const outputUrlsRef = useRef([])
	const [mode, setMode] = useState('images-to-pdf')
	const [format, setFormat] = useState('png')
	const [quality, setQuality] = useState(0.85)
	const [files, setFiles] = useState([])
	const [outputs, setOutputs] = useState([])
	const [isConverting, setIsConverting] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [notice, setNotice] = useState('')

	useEffect(() => () => {
		outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
	}, [])

	function addFiles(fileList) {
		const selected = Array.from(fileList || [])
		const validFiles = selected.filter((file) => {
			const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
			const isImage = isSupportedImage(file)
			const isDocx = DOCX_EXTENSIONS.test(file.name)
			if (mode === 'pdf-to-images') return file.size > 0 && file.size <= MAX_FILE_SIZE && isPdf
			if (mode === 'docx-to-pdf') return file.size > 0 && file.size <= 25 * 1024 * 1024 && isDocx
			return file.size > 0 && file.size <= MAX_FILE_SIZE && isImage
		})
		const unsupportedCount = selected.length - validFiles.length
		setFiles((current) => [...current, ...validFiles])
		setOutputs([])
		outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
		outputUrlsRef.current = []
		setNotice(unsupportedCount
			? `${unsupportedCount} file${unsupportedCount === 1 ? ' was' : 's were'} skipped. Choose ${mode === 'pdf-to-images' ? 'PDF files up to 100 MB' : mode === 'docx-to-pdf' ? 'DOCX files up to 25 MB' : 'supported image files up to 100 MB'}.`
			: '')
	}

	function chooseMode(nextMode) {
		if (isConverting || mode === nextMode) return
		setMode(nextMode)
		setFiles([])
		setOutputs([])
		setNotice('')
		outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
		outputUrlsRef.current = []
	}

	function removeFile(index) {
		setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
		setOutputs([])
		outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
		outputUrlsRef.current = []
	}

	async function convertFiles() {
		if (!files.length || isConverting) return
		setIsConverting(true)
		setNotice('')
		setOutputs([])
		outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
		outputUrlsRef.current = []
		try {
			let converted
			if (mode === 'images-to-pdf') {
				converted = await convertImagesToPdf(files)
			} else if (mode === 'pdf-to-images') {
				converted = []
				for (const file of files) {
					converted.push(...await convertPdfToImages(file, format, quality))
				}
			} else if (mode === 'docx-to-pdf') {
				converted = []
				for (const file of files) {
					converted.push({
						name: `${baseName(file.name)}.pdf`,
						blob: await convertDocxToPdf(file),
					})
				}
			} else {
				converted = await convertImageFormats(files, format, quality)
			}
			const results = converted.map((item) => {
				const url = URL.createObjectURL(item.blob)
				outputUrlsRef.current.push(url)
				return { ...item, url }
			})
			setOutputs(results)
			if (!results.length) setNotice('No output files were created.')
		} catch (error) {
			setNotice(error.message || 'The files could not be converted. Check the files and try again.')
		} finally {
			setIsConverting(false)
		}
	}

	function handleFileChange(event) {
		addFiles(event.target.files)
		event.target.value = ''
	}

	function handleDrop(event) {
		event.preventDefault()
		setIsDragging(false)
		addFiles(event.dataTransfer.files)
	}

	const activeMode = CONVERSION_MODES.find((item) => item.id === mode)
	const acceptsPdf = mode === 'pdf-to-images'
	const acceptsDocx = mode === 'docx-to-pdf'
	const acceptedTypes = acceptsPdf ? 'application/pdf,.pdf' : acceptsDocx
		? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx'
		: IMAGE_ACCEPT

	return (
		<main className="dashboard-layout">
			<Sidebar active="converter" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> File converter</div>
					<a className="dashboard-account-link" href="/profile">
						<span className="dashboard-account-avatar" aria-hidden="true">W</span>
						<span>My account</span>
					</a>
				</header>

				<div className="document-editor-main">
					<div className="document-editor-heading">
						<div>
							<p className="dashboard-eyebrow">PRIVATE, IN-BROWSER PROCESSING</p>
							<h1>File converter</h1>
						</div>
						<span className="compressor-local-status"><span />FILES STAY ON YOUR DEVICE</span>
					</div>

					<div className="converter-mode-list" role="tablist" aria-label="Choose a conversion">
						{CONVERSION_MODES.map((item) => (
							<button
								className={`converter-mode${mode === item.id ? ' is-active' : ''}`}
								type="button"
								role="tab"
								aria-selected={mode === item.id}
								key={item.id}
								onClick={() => chooseMode(item.id)}
								disabled={isConverting}
							>
								<strong>{item.label}</strong>
								<span>{item.description}</span>
							</button>
						))}
					</div>

					<section className="compressor-panel" aria-label={activeMode.label}>
						<div
							className={`compressor-dropzone${isDragging ? ' is-dragging' : ''}`}
							onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
							onDragOver={(event) => event.preventDefault()}
							onDragLeave={(event) => {
								if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
							}}
							onDrop={handleDrop}
						>
							<input
								ref={fileInputRef}
								className="editor-file-input"
								type="file"
								accept={acceptedTypes}
								multiple
								onChange={handleFileChange}
								disabled={isConverting}
								aria-label={`Choose files for ${activeMode.label.toLowerCase()}`}
							/>
							<span className="compressor-upload-icon" aria-hidden="true">
								<svg viewBox="0 0 32 32"><path d="M16 21V5m0 0-6 6m6-6 6 6M6 19v7h20v-7" /></svg>
							</span>
							<h2>{acceptsPdf ? 'Drop your PDF files here' : acceptsDocx ? 'Drop your DOCX files here' : 'Drop your images here'}</h2>
							<p>{activeMode.description}. Files are processed locally in this browser.</p>
							<button className="editor-open-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isConverting}>
								Choose files
							</button>
							<span className="compressor-supported-types">{acceptsPdf ? 'PDF · MAXIMUM 100 MB EACH' : acceptsDocx ? 'DOCX · MAXIMUM 25 MB EACH' : 'JPG · PNG · WEBP · BMP · SVG · MAXIMUM 100 MB EACH'}</span>
						</div>

						{files.length > 0 && (
							<div className="compressor-file-section">
								<div className="compressor-list-heading">
									<div>
										<h2>Files to convert <span>({files.length})</span></h2>
										<p>{files.map((file) => formatFileSize(file.size)).join(' · ')}</p>
									</div>
									<button
										className="compressor-clear-button"
										type="button"
										onClick={() => {
											setFiles([])
											setOutputs([])
											outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
											outputUrlsRef.current = []
										}}
										disabled={isConverting}
									>
										Clear all
									</button>
								</div>

								{mode !== 'images-to-pdf' && mode !== 'docx-to-pdf' && (
									<div className="converter-options">
										<label>
											Output format
											<select value={format} onChange={(event) => setFormat(event.target.value)} disabled={isConverting}>
												{Object.keys(IMAGE_FORMATS).map((value) => (
													<option value={value} key={value}>{value.toUpperCase()}</option>
												))}
											</select>
										</label>
										{format !== 'png' && (
											<label className="converter-quality">
												Image quality <strong>{Math.round(quality * 100)}%</strong>
												<input
													type="range"
													min="40"
													max="100"
													value={Math.round(quality * 100)}
													onChange={(event) => setQuality(Number(event.target.value) / 100)}
													disabled={isConverting}
												/>
											</label>
										)}
									</div>
								)}

								<ul className="compressor-file-list">
									{files.map((file, index) => (
										<li className="compressor-file-row" key={`${file.name}-${file.lastModified}-${index}`}>
											<span className={`compressor-file-type ${acceptsPdf ? 'pdf' : 'image'}`} aria-hidden="true">
												{acceptsPdf ? 'PDF' : 'IMG'}
											</span>
											<div className="compressor-file-info">
												<strong title={file.name}>{file.name}</strong>
												<span>{formatFileSize(file.size)}</span>
											</div>
											<button
												className="compressor-remove-button"
												type="button"
												onClick={() => removeFile(index)}
												disabled={isConverting}
												aria-label={`Remove ${file.name}`}
											>
												×
											</button>
										</li>
									))}
								</ul>
								<div className="compressor-actions">
									<button className="editor-open-button editor-save-button" type="button" onClick={convertFiles} disabled={isConverting}>
										{isConverting ? 'Converting files…' : 'Convert files'}
									</button>
								</div>
							</div>
						)}
					</section>

					{outputs.length > 0 && (
						<section className="converter-results" aria-live="polite" aria-label="Converted files">
							<div className="compressor-list-heading">
								<div>
									<h2>Ready to download <span>({outputs.length})</span></h2>
									<p>Your converted files are ready.</p>
								</div>
							</div>
							<ul className="compressor-file-list">
								{outputs.map((output, index) => (
									<li className="compressor-file-row" key={`${output.name}-${index}`}>
										<span className={`compressor-file-type ${output.name.endsWith('.pdf') ? 'pdf' : 'image'}`} aria-hidden="true">
											{output.name.endsWith('.pdf') ? 'PDF' : format.toUpperCase()}
										</span>
										<div className="compressor-file-info">
											<strong title={output.name}>{output.name}</strong>
											<span>{formatFileSize(output.blob.size)}</span>
										</div>
										<a className="editor-download-link compressor-download" href={output.url} download={output.name}>Download</a>
									</li>
								))}
							</ul>
						</section>
					)}

					<p className="compressor-notice" role="status">{notice}</p>
					<p className="compressor-privacy-note">Your files are not uploaded. DOCX conversion preserves page appearance as images, not editable/searchable text. Image-to-PDF combines selected images into one PDF; PDF-to-image creates a separate image download for each page.</p>
				</div>
			</section>
		</main>
	)
}

export default FileConverter
