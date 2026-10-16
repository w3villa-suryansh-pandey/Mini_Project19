import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getPlanFeatureLabels } from './planFeatures.js'

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = 42
const CONTENT_WIDTH = PAGE.width - MARGIN * 2
const COLORS = {
	ink: rgb(0.09, 0.13, 0.22), muted: rgb(0.36, 0.42, 0.52),
	blue: rgb(0.19, 0.32, 0.69), pale: rgb(0.94, 0.96, 0.99),
	line: rgb(0.86, 0.89, 0.94), white: rgb(1, 1, 1),
}

function pdfText(value) {
	return String(value ?? 'Not provided')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u201c\u201d]/g, '"')
		.replace(/[\u2013\u2014]/g, '-')
		.replace(/\u2026/g, '...')
		.replace(/\u20b9/g, 'INR ')
		.replace(/[^\x20-\xFF]/g, '?')
}

function formatDate(value, includeTime = false) {
	if (!value || Number.isNaN(new Date(value).getTime())) return 'Not recorded'
	return new Intl.DateTimeFormat(undefined, includeTime
		? { dateStyle: 'medium', timeStyle: 'short' }
		: { dateStyle: 'medium' }).format(new Date(value))
}

function formatCurrency(amountInPaise, currency = 'INR') {
	const amount = ((amountInPaise || 0) / 100).toFixed(2)
	return `${currency || 'INR'} ${amount}`
}

async function embedProfilePhoto(pdf, source) {
	if (!source || typeof source !== 'string') return null
	try {
		let blob
		if (source.startsWith('data:')) {
			const response = await fetch(source)
			blob = await response.blob()
		} else {
			const response = await fetch(source, { mode: 'cors', credentials: 'omit' })
			if (!response.ok) return null
			blob = await response.blob()
		}
		let bytes = new Uint8Array(await blob.arrayBuffer())
		let mimeType = blob.type.toLowerCase()
		if (mimeType.includes('png')) return await pdf.embedPng(bytes)
		if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return await pdf.embedJpg(bytes)

		// Convert formats such as WebP to PNG so pdf-lib can embed them.
		const bitmap = await createImageBitmap(blob)
		const canvas = document.createElement('canvas')
		canvas.width = bitmap.width
		canvas.height = bitmap.height
		canvas.getContext('2d').drawImage(bitmap, 0, 0)
		bitmap.close()
		const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
		if (!pngBlob) return null
		bytes = new Uint8Array(await pngBlob.arrayBuffer())
		mimeType = pngBlob.type
		return mimeType.includes('png') ? await pdf.embedPng(bytes) : null
	} catch {
		// Cross-origin profile photo hosts can block downloads; the initials badge is used instead.
		return null
	}
}

function wrapText(text, font, size, maxWidth) {
	const words = pdfText(text).split(/\s+/)
	const lines = []
	let line = ''
	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
			lines.push(line)
			line = word
		} else {
			line = candidate
		}
	}
	if (line || !lines.length) lines.push(line)
	return lines
}

export async function downloadAdminUserReport(detail) {
	if (!detail?.user) throw new Error('User information is not available for download.')
	const { user, purchases = [] } = detail
	const pdf = await PDFDocument.create()
	pdf.setTitle(`S19 user report - ${pdfText(user.name)}`)
	pdf.setSubject('User profile, account information, and subscription purchase history')
	pdf.setCreator('S19 Admin')
	const regular = await pdf.embedFont(StandardFonts.Helvetica)
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
	const profilePhoto = await embedProfilePhoto(pdf, user.profilePicture)
	let page
	let y

	function addPage() {
		page = pdf.addPage([PAGE.width, PAGE.height])
		page.drawRectangle({ x: 0, y: PAGE.height - 12, width: PAGE.width, height: 12, color: COLORS.blue })
		y = PAGE.height - MARGIN - 8
		return page
	}

	function ensureSpace(height) {
		if (!page) addPage()
		if (y - height < MARGIN + 18) addPage()
	}

	function drawSection(title, rows) {
		ensureSpace(42)
		page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_WIDTH, height: 25, color: COLORS.pale })
		page.drawText(pdfText(title), { x: MARGIN + 10, y: y - 14, size: 11, font: bold, color: COLORS.blue })
		y -= 34
		for (const [label, value] of rows) {
			const labelLines = wrapText(label, bold, 8.5, 116)
			const valueLines = wrapText(value || 'Not provided', regular, 8.5, CONTENT_WIDTH - 154)
			const lineCount = Math.max(labelLines.length, valueLines.length)
			const rowHeight = Math.max(24, lineCount * 12 + 9)
			ensureSpace(rowHeight + 2)
			labelLines.forEach((line, index) => page.drawText(line, {
				x: MARGIN + 8, y: y - 10 - index * 12, size: 8.5, font: bold, color: COLORS.muted,
			}))
			valueLines.forEach((line, index) => page.drawText(line, {
				x: MARGIN + 145, y: y - 10 - index * 12, size: 8.5, font: regular, color: COLORS.ink,
			}))
			y -= rowHeight
			page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.5, color: COLORS.line })
			y -= 2
		}
		y -= 12
	}

	addPage()
	page.drawText('S19  /  ADMIN ACCOUNT REPORT', { x: MARGIN, y: y - 2, size: 8, font: bold, color: COLORS.blue, characterSpacing: 1 })
	y -= 30
	const photoSize = 64
	const photoX = PAGE.width - MARGIN - photoSize
	const photoY = y - 63
	if (profilePhoto) {
		const dimensions = profilePhoto.scaleToFit(photoSize, photoSize)
		page.drawImage(profilePhoto, {
			x: photoX + (photoSize - dimensions.width) / 2,
			y: photoY + (photoSize - dimensions.height) / 2,
			...dimensions,
		})
		page.drawRectangle({ x: photoX - 1, y: photoY - 1, width: photoSize + 2, height: photoSize + 2, borderColor: COLORS.line, borderWidth: 1 })
	} else {
		page.drawEllipse({ x: photoX + photoSize / 2, y: photoY + photoSize / 2, xScale: photoSize / 2, yScale: photoSize / 2, color: COLORS.pale })
		const initials = pdfText((user.name || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
		const initialsSize = 18
		page.drawText(initials, { x: photoX + (photoSize - bold.widthOfTextAtSize(initials, initialsSize)) / 2, y: photoY + 22, size: initialsSize, font: bold, color: COLORS.blue })
	}
	const headerWidth = profilePhoto ? CONTENT_WIDTH - photoSize - 16 : CONTENT_WIDTH
	const nameLines = wrapText(user.name || 'User information', bold, 21, headerWidth)
	nameLines.forEach((line) => {
		ensureSpace(28)
		page.drawText(line, { x: MARGIN, y: y - 19, size: 21, font: bold, color: COLORS.ink })
		y -= 27
	})
	const identityLines = wrapText(`${user.email || ''}  |  ${user.status || 'Status unavailable'}`, regular, 9, headerWidth)
	identityLines.forEach((line) => {
		page.drawText(line, { x: MARGIN, y: y - 4, size: 9, font: regular, color: COLORS.muted })
		y -= 14
	})
	y -= 9

	drawSection('PROFILE INFORMATION', [
		['User ID', user.id], ['Full name', user.name], ['Email address', user.email],
		['Phone number', user.phone], ['Address', user.address], ['Company', user.company],
		['Job title', user.jobTitle], ['About', user.bio], ['Profile photo', user.profilePicture ? 'Embedded above' : 'No photo provided'],
	])
	drawSection('ACCOUNT INFORMATION', [
		['Account status', user.status], ['Account created', formatDate(user.createdAt, true)],
		['Last login', formatDate(user.lastLoginAt, true)],
		['Google sign-in', user.googleLinked ? 'Connected' : 'Not connected'],
		['Facebook sign-in', user.facebookLinked ? 'Connected' : 'Not connected'],
	])
	ensureSpace(44)
	page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_WIDTH, height: 25, color: COLORS.pale })
	page.drawText(`PLAN PURCHASE HISTORY (${purchases.length})`, { x: MARGIN + 10, y: y - 14, size: 11, font: bold, color: COLORS.blue })
	y -= 34
	if (!purchases.length) {
		drawSection('PURCHASES', [['History', 'No subscription purchases are recorded for this user.']])
	} else {
		purchases.forEach((purchase, index) => {
			drawSection(`${index + 1}. ${purchase.planName || 'Plan'}`, [
				['Subscription ID', purchase.id], ['Plan ID', purchase.planId],
				['Status', purchase.status], ['Price', formatCurrency(purchase.amountInPaise, purchase.currency)],
				['Duration', [purchase.durationValue, purchase.durationUnit].filter(Boolean).join(' ')],
				['Purchased', formatDate(purchase.purchasedAt, true)],
				['Starts', formatDate(purchase.startsAt, true)], ['Expires', formatDate(purchase.expiresAt, true)],
				['Enabled features', getPlanFeatureLabels(purchase.featureKeys).join(', ') || 'No features enabled'],
			])
		})
	}

	const pages = pdf.getPages()
	pages.forEach((pdfPage, index) => {
		pdfPage.drawLine({ start: { x: MARGIN, y: MARGIN }, end: { x: PAGE.width - MARGIN, y: MARGIN }, thickness: 0.6, color: COLORS.line })
		pdfPage.drawText(`S19  |  Generated ${formatDate(new Date(), true)}`, {
			x: MARGIN, y: MARGIN - 13, size: 7, font: regular, color: COLORS.muted,
		})
		const pageLabel = `Page ${index + 1} of ${pages.length}`
		pdfPage.drawText(pageLabel, {
			x: PAGE.width - MARGIN - regular.widthOfTextAtSize(pageLabel, 7), y: MARGIN - 13,
			size: 7, font: regular, color: COLORS.muted,
		})
	})

	const bytes = await pdf.save()
	const blob = new Blob([bytes], { type: 'application/pdf' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = `s19-user-report-${(user.email || user.id || 'details').replace(/[^a-z0-9]+/gi, '-')}.pdf`
	document.body.append(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}
