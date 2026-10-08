const MAX_DOCX_SIZE = 25 * 1024 * 1024
const MAX_RENDER_PIXELS = 18 * 1000 * 1000

export async function convertDocxToPdf(file) {
	if (file.size > MAX_DOCX_SIZE) {
		throw new Error('Choose a DOCX document smaller than 25 MB for browser conversion.')
	}

	const body = document.createElement('div')
	const styleContainer = document.createElement('div')
	Object.assign(body.style, {
		position: 'fixed',
		left: '-10000px',
		top: '0',
		width: '816px',
		color: '#171c19',
		background: '#ffffff',
		zIndex: '-1',
	})
	body.setAttribute('aria-hidden', 'true')
	document.body.append(styleContainer, body)

	try {
		const docxPreview = await import('docx-preview')
		await docxPreview.renderAsync(await file.arrayBuffer(), body, styleContainer, {
			useBase64URL: true,
			renderHeaders: true,
			renderFooters: true,
			renderFootnotes: true,
			renderEndnotes: true,
		})
		const width = Math.max(body.scrollWidth, 1)
		const height = Math.max(body.scrollHeight, 1)
		if (width * height > MAX_RENDER_PIXELS) {
			throw new Error('This DOCX is too long or contains too much content to convert safely in the browser.')
		}

		const html2pdfModule = await import('html2pdf.js')
		const html2pdf = html2pdfModule.default || html2pdfModule
		const worker = html2pdf().set({
			margin: [36, 36, 36, 36],
			filename: `${file.name.replace(/\.docx$/i, '')}.pdf`,
			image: { type: 'jpeg', quality: 0.94 },
			enableLinks: false,
			pagebreak: { mode: ['css', 'legacy'] },
			html2canvas: {
				scale: 1,
				backgroundColor: '#ffffff',
				logging: false,
				useCORS: false,
			},
			jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
		}).from(body)
		const blob = await worker.outputPdf('blob')
		if (!(blob instanceof Blob) || blob.size === 0) {
			throw new Error('DOCX conversion did not produce a valid PDF.')
		}
		return blob
	} finally {
		styleContainer.remove()
		body.remove()
	}
}
