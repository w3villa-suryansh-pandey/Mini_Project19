import { useEffect, useRef, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import AccountBadge from '../../components/AccountBadge.jsx'

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.bmp,.pdf'
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp'])

function formatFileSize(size) {
	if (size < 1024) return `${size} B`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
	return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function getFileKind(file) {
	const extension = file.name.split('.').pop()?.toLowerCase()
	if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf'
	if (IMAGE_TYPES.has(file.type) || ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(extension)) return 'image'
	return null
}

function createImageBlob(file, quality) {
	return new Promise((resolve, reject) => {
		const imageUrl = URL.createObjectURL(file)
		const image = new Image()
		image.onload = () => {
			URL.revokeObjectURL(imageUrl)
			const canvas = document.createElement('canvas')
			canvas.width = image.naturalWidth
			canvas.height = image.naturalHeight
			const context = canvas.getContext('2d')
			if (!context) {
				reject(new Error('Your browser could not prepare this image for compression.'))
				return
			}
			context.drawImage(image, 0, 0)
			canvas.toBlob((blob) => {
				if (blob) resolve(blob)
				else reject(new Error('Your browser could not compress this image.'))
			}, 'image/webp', quality)
		}
		image.onerror = () => {
			URL.revokeObjectURL(imageUrl)
			reject(new Error('This image could not be opened. Try a different image file.'))
		}
		image.src = imageUrl
	})
}

async function compressFile(file, quality) {
	if (getFileKind(file) === 'image') {
		const blob = await createImageBlob(file, quality)
		const baseName = file.name.replace(/\.[^.]+$/, '')
		return { blob, name: `${baseName}.webp` }
	}

	const { PDFDocument } = await import('pdf-lib')
	const pdf = await PDFDocument.load(await file.arrayBuffer())
	const bytes = await pdf.save({ useObjectStreams: true })
	return { blob: new Blob([bytes], { type: 'application/pdf' }), name: file.name }
}

function getSizeSummary(originalSize, compressedSize) {
	const difference = originalSize - compressedSize
	if (difference > 0) {
		return `Reduced by ${formatFileSize(difference)} (${Math.round((difference / originalSize) * 100)}%).`
	}
	if (difference < 0) {
		return `The result is ${formatFileSize(-difference)} larger. Try a lower image quality or keep the original.`
	}
	return 'The result is the same size as the original.'
}

function FileCompressor() {
	const fileInputRef = useRef(null)
	const downloadUrlsRef = useRef(new Map())
	const [files, setFiles] = useState([])
	const [quality, setQuality] = useState(0.75)
	const [isCompressing, setIsCompressing] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [notice, setNotice] = useState('')

	useEffect(() => () => {
		downloadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
		downloadUrlsRef.current.clear()
	}, [])

	function addFiles(fileList) {
		const selected = Array.from(fileList || [])
		if (!selected.length) return
		const validFiles = selected.filter((file) => getFileKind(file))
		const rejectedCount = selected.length - validFiles.length
		const newRecords = validFiles.map((file) => ({
			id: `${Date.now()}-${Math.random()}`,
			file,
			status: 'ready',
			result: null,
			error: '',
		}))
		setFiles((current) => [...current, ...newRecords])
		setNotice(rejectedCount
			? `${rejectedCount} unsupported file${rejectedCount === 1 ? ' was' : 's were'} skipped. Choose an image or PDF.`
			: '')
	}

	function removeFile(id) {
		const previousUrl = downloadUrlsRef.current.get(id)
		if (previousUrl) URL.revokeObjectURL(previousUrl)
		downloadUrlsRef.current.delete(id)
		setFiles((current) => current.filter((item) => item.id !== id))
	}

	function clearFiles() {
		downloadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
		downloadUrlsRef.current.clear()
		setFiles([])
		setNotice('')
	}

	async function compressFiles() {
		if (isCompressing) return
		setIsCompressing(true)
		setNotice('')
		const pendingFiles = files

		for (const item of pendingFiles) {
			setFiles((current) => current.map((record) => (
				record.id === item.id ? { ...record, status: 'compressing', error: '' } : record
			)))
			try {
				const compressed = await compressFile(item.file, quality)
				const previousUrl = downloadUrlsRef.current.get(item.id)
				if (previousUrl) URL.revokeObjectURL(previousUrl)
				const downloadUrl = URL.createObjectURL(compressed.blob)
				downloadUrlsRef.current.set(item.id, downloadUrl)
				setFiles((current) => current.map((record) => (
					record.id === item.id
						? { ...record, status: 'done', result: { ...compressed, downloadUrl }, error: '' }
						: record
				)))
			} catch (error) {
				setFiles((current) => current.map((record) => (
					record.id === item.id
						? { ...record, status: 'error', error: error.message || 'This file could not be compressed.' }
						: record
				)))
			}
		}
		setIsCompressing(false)
	}

	function handleFileInput(event) {
		addFiles(event.target.files)
		event.target.value = ''
	}

	function handleDrop(event) {
		event.preventDefault()
		setIsDragging(false)
		addFiles(event.dataTransfer.files)
	}

	return (
		<main className="dashboard-layout">
			<Sidebar active="compressor" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> Compress files</div>
					<AccountBadge />
				</header>

				<div className="document-editor-main">
					<div className="document-editor-heading">
						<div>
							<p className="dashboard-eyebrow">PRIVATE, IN-BROWSER PROCESSING</p>
							<h1>Compress files</h1>
						</div>
						<span className="compressor-local-status"><span />FILES STAY ON YOUR DEVICE</span>
					</div>

					<section className="compressor-panel" aria-label="File compression workspace">
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
								accept={ACCEPTED_FILE_TYPES}
								multiple
								onChange={handleFileInput}
								disabled={isCompressing}
								aria-label="Choose image or PDF files"
							/>
							<span className="compressor-upload-icon" aria-hidden="true">
								<svg viewBox="0 0 32 32"><path d="M16 21V5m0 0-6 6m6-6 6 6M6 19v7h20v-7" /></svg>
							</span>
							<h2>Drop your files here</h2>
							<p>Images and PDF documents are compressed locally in your browser.</p>
							<button
								className="editor-open-button"
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={isCompressing}
							>
								Choose files
							</button>
							<span className="compressor-supported-types">JPG, PNG, WEBP, BMP, PDF</span>
						</div>

						{files.length > 0 && (
							<div className="compressor-file-section">
								<div className="compressor-list-heading">
									<div>
										<h2>Your files <span>({files.length})</span></h2>
										<p>Adjust image quality, then compress your files.</p>
									</div>
									<button className="compressor-clear-button" type="button" onClick={clearFiles} disabled={isCompressing}>
										Clear all
									</button>
								</div>

								<label className="compressor-quality">
									<span>Image quality <strong>{Math.round(quality * 100)}%</strong></span>
									<input
										type="range"
										min="35"
										max="95"
										value={Math.round(quality * 100)}
										onChange={(event) => setQuality(Number(event.target.value) / 100)}
										disabled={isCompressing}
									/>
									<span className="compressor-quality-hint">Lower quality usually means a smaller image. PDF files are optimized without changing page content.</span>
								</label>

								<ul className="compressor-file-list">
									{files.map((item) => (
										<li className="compressor-file-row" key={item.id}>
											<span className={`compressor-file-type ${getFileKind(item.file)}`} aria-hidden="true">
												{getFileKind(item.file) === 'pdf' ? 'PDF' : 'IMG'}
											</span>
											<div className="compressor-file-info">
												<strong title={item.file.name}>{item.file.name}</strong>
												<span>{formatFileSize(item.file.size)}{item.result ? ` → ${formatFileSize(item.result.blob.size)}` : ''}</span>
												{item.error && <span className="compressor-error">{item.error}</span>}
												{item.result && (
													<span className={item.result.blob.size < item.file.size ? 'compressor-savings' : 'compressor-no-savings'}>
														{getSizeSummary(item.file.size, item.result.blob.size)}
													</span>
												)}
											</div>
											{item.status === 'compressing' && <span className="compressor-item-status">Compressing…</span>}
											{item.result && (
												<a className="editor-download-link compressor-download" href={item.result.downloadUrl} download={item.result.name}>
													Download
												</a>
											)}
											<button
												className="compressor-remove-button"
												type="button"
												onClick={() => removeFile(item.id)}
												disabled={isCompressing}
												aria-label={`Remove ${item.file.name}`}
											>
												×
											</button>
										</li>
									))}
								</ul>

								<div className="compressor-actions">
									<button
										className="editor-open-button editor-save-button"
										type="button"
										onClick={compressFiles}
										disabled={isCompressing || files.length === 0}
									>
										{isCompressing ? 'Compressing files…' : files.every((item) => item.status === 'done') ? 'Compress again' : 'Compress files'}
									</button>
								</div>
							</div>
						)}
					</section>
					<p className="compressor-notice" aria-live="polite">{notice}</p>
					<p className="compressor-privacy-note">Your files are processed on this device and are not uploaded to a server. PDF compression depends on the contents of the original file.</p>
				</div>
			</section>
		</main>
	)
}

export default FileCompressor
