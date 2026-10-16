import { getPlanFeatureLabels } from './planFeatures.js'

function formatDate(value, includeTime = false) {
	if (!value || Number.isNaN(new Date(value).getTime())) return 'Not recorded'
	return new Intl.DateTimeFormat(undefined, includeTime
		? { dateStyle: 'medium', timeStyle: 'short' }
		: { dateStyle: 'medium' }).format(new Date(value))
}

function formatCurrency(amountInPaise, currency = 'INR') {
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).format((amountInPaise || 0) / 100)
	} catch {
		return `${((amountInPaise || 0) / 100).toFixed(2)} ${currency || ''}`.trim()
	}
}

function appendText(parent, tag, value, styles = {}) {
	const element = document.createElement(tag)
	element.textContent = String(value ?? 'Not provided')
	Object.assign(element.style, styles)
	parent.append(element)
	return element
}

function appendRows(parent, rows) {
	rows.forEach(([label, value]) => {
		const row = document.createElement('div')
		Object.assign(row.style, {
			display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: '14px',
			padding: '8px 0', borderBottom: '1px solid #e8edf5', fontSize: '11px',
			lineHeight: '1.5', breakInside: 'avoid',
		})
		appendText(row, 'strong', label, { color: '#53627a', fontWeight: '600' })
		appendText(row, 'span', value || 'Not provided', { color: '#172033', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' })
		parent.append(row)
	})
}

function appendSection(report, title, rows) {
	const section = document.createElement('section')
	Object.assign(section.style, { margin: '0 0 22px', breakInside: 'avoid' })
	appendText(section, 'h2', title, {
		margin: '0 0 6px', padding: '0 0 8px', color: '#3154b5',
		borderBottom: '2px solid #dbe5fa', fontSize: '15px',
	})
	appendRows(section, rows)
	report.append(section)
}

export async function downloadAdminUserReport(detail) {
	if (!detail?.user) throw new Error('User information is not available for download.')
	const { user, purchases = [] } = detail
	const report = document.createElement('main')
	Object.assign(report.style, {
		position: 'fixed', left: '-12000px', top: '0', width: '720px', padding: '38px',
		boxSizing: 'border-box', background: '#ffffff', color: '#172033',
		fontFamily: 'Arial, Helvetica, sans-serif',
	})
	report.setAttribute('aria-hidden', 'true')
	const masthead = document.createElement('header')
	Object.assign(masthead.style, { borderBottom: '3px solid #3154b5', paddingBottom: '15px', marginBottom: '24px' })
	appendText(masthead, 'p', 'S19  /  ADMIN ACCOUNT REPORT', { margin: '0 0 8px', color: '#526bb3', fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px' })
	appendText(masthead, 'h1', user.name || 'User information', { margin: '0 0 5px', color: '#172033', fontSize: '25px' })
	appendText(masthead, 'p', `${user.email || ''}  ·  ${user.status || 'Status unavailable'}`, { margin: '0', color: '#64748b', fontSize: '11px' })
	report.append(masthead)

	appendSection(report, 'Profile information', [
		['User ID', user.id], ['Full name', user.name], ['Email address', user.email],
		['Phone number', user.phone], ['Address', user.address], ['Company', user.company],
		['Job title', user.jobTitle], ['About', user.bio], ['Profile photo URL', user.profilePicture],
	])
	appendSection(report, 'Account information', [
		['Account status', user.status], ['Account created', formatDate(user.createdAt, true)],
		['Last login', formatDate(user.lastLoginAt, true)],
		['Google sign-in', user.googleLinked ? 'Connected' : 'Not connected'],
		['Facebook sign-in', user.facebookLinked ? 'Connected' : 'Not connected'],
	])

	const history = document.createElement('section')
	appendText(history, 'h2', `Plan purchase history (${purchases.length})`, {
		margin: '0 0 12px', padding: '0 0 8px', color: '#3154b5',
		borderBottom: '2px solid #dbe5fa', fontSize: '15px',
	})
	if (!purchases.length) {
		appendText(history, 'p', 'No subscription purchases are recorded for this user.', { color: '#64748b', fontSize: '11px' })
	} else {
		purchases.forEach((purchase, index) => {
			const card = document.createElement('article')
			Object.assign(card.style, {
				margin: '0 0 14px', padding: '13px 15px', border: '1px solid #dce5f3',
				borderRadius: '8px', background: index % 2 ? '#f7f9fd' : '#ffffff', breakInside: 'avoid',
			})
			appendText(card, 'h3', `${index + 1}. ${purchase.planName || 'Plan'}`, { margin: '0 0 8px', color: '#243d82', fontSize: '13px' })
			const duration = [purchase.durationValue, purchase.durationUnit].filter(Boolean).join(' ')
			appendRows(card, [
				['Subscription ID', purchase.id], ['Plan ID', purchase.planId],
				['Status', purchase.status], ['Price', formatCurrency(purchase.amountInPaise, purchase.currency)],
				['Duration', duration], ['Purchased', formatDate(purchase.purchasedAt, true)],
				['Starts', formatDate(purchase.startsAt, true)], ['Expires', formatDate(purchase.expiresAt, true)],
				['Enabled features', getPlanFeatureLabels(purchase.featureKeys).join(', ') || 'No features enabled'],
			])
			history.append(card)
		})
	}
	report.append(history)
	appendText(report, 'footer', `Generated ${formatDate(new Date(), true)}  ·  S19`, {
		margin: '24px 0 0', paddingTop: '10px', borderTop: '1px solid #dce5f3',
		color: '#8490a3', fontSize: '9px', textAlign: 'center',
	})
	document.body.append(report)

	try {
		const module = await import('html2pdf.js')
		const html2pdf = module.default || module
		const pdfBlob = await html2pdf().set({
			margin: [32, 36, 32, 36],
			image: { type: 'jpeg', quality: 0.98 },
			enableLinks: false,
			pagebreak: { mode: ['css', 'legacy'], avoid: ['article', 'section'] },
			html2canvas: { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: false },
			jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait', compress: true },
		}).from(report).outputPdf('blob')
		if (!(pdfBlob instanceof Blob) || pdfBlob.size < 100) throw new Error('The PDF could not be created.')
		const url = URL.createObjectURL(pdfBlob)
		const link = document.createElement('a')
		link.href = url
		link.download = `s19-user-report-${(user.email || user.id || 'details').replace(/[^a-z0-9]+/gi, '-')}.pdf`
		document.body.append(link)
		link.click()
		link.remove()
		setTimeout(() => URL.revokeObjectURL(url), 1000)
	} finally {
		report.remove()
	}
}
