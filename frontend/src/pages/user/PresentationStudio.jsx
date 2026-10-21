import { useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import WorkspaceHeader from '../../components/WorkspaceHeader.jsx'
import { FeatureAccessNotice, useFeatureAccess } from '../../utils/featureAccess.jsx'

const STORAGE_KEY = 'w3villa-presentation-deck'
const LIBRARY_KEY = 'w3villa-presentation-library'
const DB_NAME = 'w3villa-presentation-files'
const DB_STORE = 'sources'
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
const THEME_COLORS = {
	indigo: { background: 'F6F7FF', accent: '5B53D8', ink: '202642' },
	ocean: { background: 'F0FAFC', accent: '087F98', ink: '16333D' },
	charcoal: { background: '20283B', accent: '9B8CFF', ink: 'F6F5FF' },
}
const SLIDE_LAYOUTS = [
	{ id: 'title-slide', label: 'Title slide' },
	{ id: 'title-content', label: 'Title and content' },
	{ id: 'two-column', label: 'Two columns' },
	{ id: 'section-header', label: 'Section header' },
	{ id: 'blank', label: 'Blank' },
]

function createId() {
	return globalThis.crypto?.randomUUID?.() || `slide-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function makeSlide(title = 'New slide', body = 'Add your ideas here.', layout = 'title-content') {
	const slide = { id: createId(), title, body, layout, background: '', titleStyle: null, bodyStyle: null, titlePosition: { x: 8, y: 16 }, bodyPosition: { x: 8, y: 36 }, textBlocks: [], sourcePart: null, titleShapeIndex: null, bodyShapeIndex: null }
	if (layout === 'title-slide') {
		slide.titlePosition = { x: 8, y: 27 }
		slide.bodyPosition = { x: 8, y: 52 }
	}
	if (layout === 'section-header') {
		slide.titlePosition = { x: 8, y: 35 }
		slide.bodyPosition = { x: 8, y: 57 }
	}
	if (layout === 'two-column') {
		slide.body = ''
		slide.titlePosition = { x: 8, y: 12 }
		slide.textBlocks = [
			{ id: createId(), text: 'Left column', position: { x: 8, y: 34 }, width: 39, style: defaultTextStyle('body', 'indigo') },
			{ id: createId(), text: 'Right column', position: { x: 54, y: 34 }, width: 39, style: defaultTextStyle('body', 'indigo') },
		]
	}
	if (layout === 'blank') {
		slide.title = ''
		slide.body = ''
	}
	return slide
}

function defaultTextStyle(kind, themeName) {
	const theme = THEME_COLORS[themeName] || THEME_COLORS.indigo
	return {
		fontSize: kind === 'title' ? 36 : 18,
		color: `#${theme.ink}`,
		fontFamily: kind === 'title' ? 'Aptos Display' : 'Aptos',
		bold: kind === 'title',
		italic: false,
		underline: false,
		align: 'left',
	}
}

function makeDeck() {
	return {
		id: createId(),
		title: 'Untitled presentation',
		theme: 'indigo',
		imported: false,
		sourceId: '',
		slides: [makeSlide('Your presentation starts here', 'Add a clear message, then build the rest of your story one slide at a time.')],
	}
}

function getSavedDeck() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
		if (saved?.slides?.length) return saved
	} catch {
		// Start with a new deck when saved browser data is unavailable.
	}
	return makeDeck()
}

function getSavedLibrary() {
	try {
		const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')
		return Array.isArray(library) ? library.filter((deck) => deck?.id && deck.slides?.length) : []
	} catch {
		return []
	}
}

function openSourceDatabase() {
	return new Promise((resolve, reject) => {
		if (!('indexedDB' in window)) return reject(new Error('Browser file storage is unavailable.'))
		const request = indexedDB.open(DB_NAME, 1)
		request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error || new Error('Could not open presentation storage.'))
	})
}

async function storeSourceFile(sourceId, fileBuffer) {
	const db = await openSourceDatabase()
	await new Promise((resolve, reject) => {
		const transaction = db.transaction(DB_STORE, 'readwrite')
		transaction.objectStore(DB_STORE).put(fileBuffer, sourceId)
		transaction.oncomplete = resolve
		transaction.onerror = () => reject(transaction.error)
	})
	db.close()
}

async function readSourceFile(sourceId) {
	const db = await openSourceDatabase()
	const value = await new Promise((resolve, reject) => {
		const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(sourceId)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
	db.close()
	return value
}

function parseXml(xml, label) {
	const document = new DOMParser().parseFromString(xml, 'application/xml')
	if (document.getElementsByTagName('parsererror').length) throw new Error(`${label} is not valid PowerPoint XML.`)
	return document
}

function readRelationships(xml) {
	const document = parseXml(xml, 'PowerPoint relationships')
	return [...document.getElementsByTagNameNS(REL_NS, 'Relationship')].map((relationship) => ({
		id: relationship.getAttribute('Id'),
		type: relationship.getAttribute('Type'),
		target: relationship.getAttribute('Target'),
	}))
}

function resolvePartPath(baseDirectory, target) {
	const parts = (target.startsWith('/') ? target.slice(1) : `${baseDirectory}/${target}`).split('/')
	const resolved = []
	for (const part of parts) {
		if (!part || part === '.') continue
		if (part === '..') resolved.pop()
		else resolved.push(part)
	}
	return resolved.join('/')
}

function extractText(shape) {
	const textBody = shape.getElementsByTagNameNS(A_NS, 'txBody')[0]
	if (!textBody) return ''
	return [...textBody.getElementsByTagNameNS(A_NS, 'p')]
		.map((paragraph) => [...paragraph.getElementsByTagNameNS(A_NS, 't')].map((text) => text.textContent || '').join(''))
		.join('\n')
}

function getShapePlaceholder(shape) {
	const placeholder = shape.getElementsByTagNameNS(P_NS, 'ph')[0]
	return placeholder?.getAttribute('type') || ''
}

function getShapePosition(shape) {
	const offset = shape.getElementsByTagNameNS(A_NS, 'off')[0]
	if (!offset) return null
	return {
		x: Math.max(0, Math.min(90, (Number(offset.getAttribute('x')) / 12192000) * 100)),
		y: Math.max(0, Math.min(88, (Number(offset.getAttribute('y')) / 6858000) * 100)),
	}
}

function inspectSlide(xml, sourcePart) {
	const document = parseXml(xml, 'PowerPoint slide')
	const shapes = [...document.getElementsByTagNameNS(P_NS, 'sp')]
	const entries = shapes.map((shape, index) => ({ index, text: extractText(shape).trim(), placeholder: getShapePlaceholder(shape), position: getShapePosition(shape) }))
	const title = entries.find((shape) => ['title', 'ctrTitle'].includes(shape.placeholder)) || entries.find((shape) => shape.text)
	const body = entries.find((shape) => ['body', 'subTitle', 'obj'].includes(shape.placeholder) && shape.index !== title?.index)
		|| entries.find((shape) => shape.text && shape.index !== title?.index)
	return {
		id: createId(),
		layout: 'imported',
		background: '',
		title: title?.text || 'Untitled slide',
		body: body?.text || '',
		extraTextShapes: entries.filter((shape) => shape.text && shape.index !== title?.index && shape.index !== body?.index).map(({ index, text }) => ({ shapeIndex: index, text, style: null, styleDirty: false })),
		sourcePart,
		titleShapeIndex: title?.index ?? null,
		bodyShapeIndex: body?.index ?? null,
		titlePosition: title?.position || { x: 8, y: 23 },
		bodyPosition: body?.position || { x: 8, y: 54 },
	}
}

async function readPresentation(zip) {
	const presentationFile = zip.file('ppt/presentation.xml')
	const relationshipsFile = zip.file('ppt/_rels/presentation.xml.rels')
	if (!presentationFile || !relationshipsFile) throw new Error('This file does not contain a readable PowerPoint presentation.')
	const [presentationXml, relationshipXml] = await Promise.all([presentationFile.async('string'), relationshipsFile.async('string')])
	const presentation = parseXml(presentationXml, 'PowerPoint presentation')
	const relationships = new Map(readRelationships(relationshipXml).map((item) => [item.id, item]))
	const slideIds = [...presentation.getElementsByTagNameNS(P_NS, 'sldId')]
	const slides = []
	for (const slideId of slideIds) {
		const relationship = relationships.get(slideId.getAttributeNS(R_NS, 'id'))
		if (!relationship || !relationship.type.endsWith('/slide')) continue
		const part = resolvePartPath('ppt', relationship.target)
		const slideFile = zip.file(part)
		if (!slideFile) continue
		slides.push(inspectSlide(await slideFile.async('string'), part))
	}
	if (!slides.length) throw new Error('No editable slides were found in this PowerPoint file.')
	return slides
}

function styleParagraphAndRun(paragraph, style, document) {
	if (!style) return
	let paragraphProperties = paragraph.getElementsByTagNameNS(A_NS, 'pPr')[0]
	if (!paragraphProperties) {
		paragraphProperties = document.createElementNS(A_NS, 'a:pPr')
		paragraph.insertBefore(paragraphProperties, paragraph.firstChild)
	}
	paragraphProperties.setAttribute('algn', style.align === 'center' ? 'ctr' : style.align === 'right' ? 'r' : 'l')
	const run = paragraph.getElementsByTagNameNS(A_NS, 'r')[0]
	if (!run) return
	let runProperties = run.getElementsByTagNameNS(A_NS, 'rPr')[0]
	if (!runProperties) {
		runProperties = document.createElementNS(A_NS, 'a:rPr')
		runProperties.setAttribute('lang', 'en-US')
		run.insertBefore(runProperties, run.firstChild)
	}
	if (style.fontSize) runProperties.setAttribute('sz', String(Math.round(Number(style.fontSize) * 100)))
	for (const [key, enabled] of [['b', style.bold], ['i', style.italic]]) {
		if (enabled) runProperties.setAttribute(key, '1')
		else runProperties.removeAttribute(key)
	}
	if (style.underline) runProperties.setAttribute('u', 'sng')
	else runProperties.removeAttribute('u')
	const existingFills = [...runProperties.children].filter((child) => child.namespaceURI === A_NS && child.localName === 'solidFill')
	existingFills.forEach((fill) => fill.remove())
	const color = String(style.color || '#202642').replace('#', '').toUpperCase()
	const fill = document.createElementNS(A_NS, 'a:solidFill')
	const rgb = document.createElementNS(A_NS, 'a:srgbClr')
	rgb.setAttribute('val', color)
	fill.appendChild(rgb)
	runProperties.insertBefore(fill, runProperties.firstChild)
	const oldLatin = [...runProperties.children].find((child) => child.namespaceURI === A_NS && child.localName === 'latin')
	if (oldLatin) oldLatin.remove()
	const latin = document.createElementNS(A_NS, 'a:latin')
	latin.setAttribute('typeface', style.fontFamily || 'Aptos')
	runProperties.appendChild(latin)
}

function replaceShapeText(xml, shapeIndex, value, style = null) {
	if (shapeIndex == null) return xml
	const document = parseXml(xml, 'PowerPoint slide')
	const shape = [...document.getElementsByTagNameNS(P_NS, 'sp')][shapeIndex]
	const textBody = shape?.getElementsByTagNameNS(A_NS, 'txBody')[0]
	if (!textBody) return xml
	const paragraphs = [...textBody.getElementsByTagNameNS(A_NS, 'p')]
	const template = paragraphs[0]?.cloneNode(true)
	if (!template) return xml
	paragraphs.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph))
	String(value).split('\n').forEach((line) => {
		const paragraph = template.cloneNode(true)
		const runs = [...paragraph.getElementsByTagNameNS(A_NS, 'r')]
		if (!runs.length) {
			const run = document.createElementNS(A_NS, 'a:r')
			const runProperties = document.createElementNS(A_NS, 'a:rPr')
			runProperties.setAttribute('lang', 'en-US')
			const text = document.createElementNS(A_NS, 'a:t')
			run.append(runProperties, text)
			const endProperties = paragraph.getElementsByTagNameNS(A_NS, 'endParaRPr')[0]
			paragraph.insertBefore(run, endProperties || null)
			text.textContent = line
		} else {
			const firstText = runs[0].getElementsByTagNameNS(A_NS, 't')[0]
			if (firstText) firstText.textContent = line
			else {
				const text = document.createElementNS(A_NS, 'a:t')
				text.textContent = line
				runs[0].appendChild(text)
			}
			runs.slice(1).forEach((run) => run.parentNode?.removeChild(run))
		}
		styleParagraphAndRun(paragraph, style, document)
		textBody.appendChild(paragraph)
	})
	return new XMLSerializer().serializeToString(document)
}

function appendTextShape(xml, name, value, position, style) {
	const document = parseXml(xml, 'PowerPoint slide')
	const tree = document.getElementsByTagNameNS(P_NS, 'spTree')[0]
	if (!tree) return xml
	const shapeIds = [...document.getElementsByTagNameNS(P_NS, 'cNvPr')].map((item) => Number(item.getAttribute('id')) || 0)
	const id = Math.max(1, ...shapeIds) + 1
	const x = typeof position === 'object' ? Math.round(position.x * 121920) : 914400
	const y = typeof position === 'object' ? Math.round(position.y * 68580) : position === 'title' ? 1050000 : 3100000
	const height = position === 'title' ? 1600000 : 2200000
	const widthLimit = typeof position === 'object' ? 6500000 : 9509760
	const width = typeof position === 'object' ? Math.max(500000, Math.min(widthLimit, Math.round((96 - position.x) * 121920))) : widthLimit
	const textStyle = style || defaultTextStyle(position === 'title' ? 'title' : 'body', 'indigo')
	const size = Math.round(Number(textStyle.fontSize || 18) * 100)
	const align = textStyle.align === 'center' ? 'ctr' : textStyle.align === 'right' ? 'r' : 'l'
	const runFlags = `${textStyle.bold ? ' b="1"' : ''}${textStyle.italic ? ' i="1"' : ''}${textStyle.underline ? ' u="sng"' : ''}`
	const color = String(textStyle.color || '#202642').replace('#', '').toUpperCase()
	const fontFamily = escapeXml(textStyle.fontFamily || 'Aptos')
	const xmlShape = `<p:sp xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${String(value).split('\n').map((line) => `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${size}"${runFlags}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${fontFamily}"/></a:rPr><a:t xml:space="preserve">${escapeXml(line)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`
	const shape = parseXml(xmlShape, 'PowerPoint text box').documentElement
	tree.appendChild(document.importNode(shape, true))
	return new XMLSerializer().serializeToString(document)
}

function escapeXml(value) {
	return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function buildSlideXml(slide, themeName) {
	const theme = THEME_COLORS[themeName] || THEME_COLORS.indigo
	const background = /^#[0-9a-f]{6}$/i.test(slide.background || '') ? slide.background.slice(1).toUpperCase() : theme.background
	const textShape = (id, name, x, y, width, height, text, style) => {
		const size = Math.round(Number(style.fontSize || 18) * 100)
		const bold = style.bold ? ' b="1"' : ''
		const italic = style.italic ? ' i="1"' : ''
		const underline = style.underline ? ' u="sng"' : ''
		const color = String(style.color || `#${theme.ink}`).replace('#', '').toUpperCase()
		const align = style.align === 'center' ? 'ctr' : style.align === 'right' ? 'r' : 'l'
		const fontFamily = escapeXml(style.fontFamily || 'Aptos')
		return `
		<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
		<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
		<p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0"/><a:lstStyle/>${String(text || '').split('\n').map((line) => `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${size}"${bold}${italic}${underline}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${fontFamily}"/></a:rPr><a:t xml:space="preserve">${escapeXml(line)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`).join('')}</p:txBody></p:sp>`
	}
	const titleStyle = slide.titleStyle || defaultTextStyle('title', themeName)
	const bodyStyle = slide.bodyStyle || defaultTextStyle('body', themeName)
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
	<p:sld xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>
	<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
	${slide.layout === 'blank' ? '' : textShape(2, 'Title', Math.round((slide.titlePosition?.x ?? 8) * 121920), Math.round((slide.titlePosition?.y ?? 23) * 68580), Math.max(500000, Math.round((96 - (slide.titlePosition?.x ?? 8)) * 121920)), 1600000, slide.title || 'Untitled slide', titleStyle)}
	${['blank', 'two-column'].includes(slide.layout) ? '' : textShape(3, 'Body', Math.round((slide.bodyPosition?.x ?? 8) * 121920), Math.round((slide.bodyPosition?.y ?? 54) * 68580), Math.max(500000, Math.round((96 - (slide.bodyPosition?.x ?? 8)) * 121920)), 2200000, slide.body || '', bodyStyle)}
	${(slide.textBlocks || []).map((block, index) => textShape(index + 4, `Text Box ${index + 1}`, Math.round((block.position?.x ?? 20) * 121920), Math.round((block.position?.y ?? 20) * 68580), Math.max(500000, Math.min(6500000, Math.round((block.width ?? (96 - (block.position?.x ?? 20))) * 121920))), 2200000, block.text, block.style || defaultTextStyle('body', themeName))).join('')}
	</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
}

function createPptxArchive(deck) {
	const zip = new JSZip()
	const slideIds = deck.slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('')
	const slideRels = deck.slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${R_NS}/slide" Target="slides/slide${index + 1}.xml"/>`).join('')
	const slideOverrides = deck.slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')
	const theme = THEME_COLORS[deck.theme] || THEME_COLORS.indigo
	zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides}</Types>`)
	zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`)
	zip.folder('ppt').file('presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`)
	zip.folder('ppt').folder('_rels').file('presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">${slideRels}<Relationship Id="rIdMaster" Type="${R_NS}/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rIdTheme" Type="${R_NS}/theme" Target="theme/theme1.xml"/></Relationships>`)
	zip.folder('ppt').folder('slides')
	deck.slides.forEach((slide, index) => {
		zip.file(`ppt/slides/slide${index + 1}.xml`, buildSlideXml(slide, deck.theme))
		zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${R_NS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`)
	})
	zip.folder('ppt').folder('slideMasters').file('slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`)
	zip.folder('ppt').folder('slideMasters').folder('_rels').file('slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${R_NS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${R_NS}/theme" Target="../theme/theme1.xml"/></Relationships>`)
	zip.folder('ppt').folder('slideLayouts').file('slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`)
	zip.folder('ppt').folder('slideLayouts').folder('_rels').file('slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${R_NS}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`)
	zip.folder('ppt').folder('theme').file('theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="${A_NS}" name="S19"><a:themeElements><a:clrScheme name="S19"><a:dk1><a:srgbClr val="${theme.ink}"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="202642"/></a:dk2><a:lt2><a:srgbClr val="${theme.background}"/></a:lt2><a:accent1><a:srgbClr val="${theme.accent}"/></a:accent1><a:accent2><a:srgbClr val="23A6B7"/></a:accent2><a:accent3><a:srgbClr val="EF8B55"/></a:accent3><a:accent4><a:srgbClr val="8B72D8"/></a:accent4><a:accent5><a:srgbClr val="62A17C"/></a:accent5><a:accent6><a:srgbClr val="D06E9F"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="S19"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="S19"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"/></a:gs></a:gsLst><a:lin ang="0" scaled="1"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`)
	return zip
}

function updateXmlShape(xml, index, text, style = null) {
	return replaceShapeText(xml, index, text, style)
}

function updateXmlShapePosition(xml, index, position) {
	if (index == null || !position) return xml
	const document = parseXml(xml, 'PowerPoint slide')
	const shape = [...document.getElementsByTagNameNS(P_NS, 'sp')][index]
	const offset = shape?.getElementsByTagNameNS(A_NS, 'off')[0]
	if (!offset) return xml
	offset.setAttribute('x', String(Math.round(position.x * 121920)))
	offset.setAttribute('y', String(Math.round(position.y * 68580)))
	const extent = shape?.getElementsByTagNameNS(A_NS, 'ext')[0]
	if (extent) extent.setAttribute('cx', String(Math.max(500000, Math.round((96 - position.x) * 121920))))
	return new XMLSerializer().serializeToString(document)
}

async function updateImportedArchive(zip, deck) {
	const presentationPath = 'ppt/presentation.xml'
	const presentationRelsPath = 'ppt/_rels/presentation.xml.rels'
	const contentTypesPath = '[Content_Types].xml'
	const [presentationText, relsText, typesText] = await Promise.all([
		zip.file(presentationPath).async('string'),
		zip.file(presentationRelsPath).async('string'),
		zip.file(contentTypesPath).async('string'),
	])
	const presentation = parseXml(presentationText, 'PowerPoint presentation')
	const rels = parseXml(relsText, 'PowerPoint relationships')
	const contentTypes = parseXml(typesText, 'PowerPoint content types')
	const relationRoot = rels.documentElement
	const slideList = presentation.getElementsByTagNameNS(P_NS, 'sldIdLst')[0]
	if (!slideList) throw new Error('The PowerPoint file has no slide list to update.')
	const oldSlideRelations = [...rels.getElementsByTagNameNS(REL_NS, 'Relationship')]
		.filter((relationship) => relationship.getAttribute('Type').endsWith('/slide'))
	const maxRelId = Math.max(0, ...[...rels.getElementsByTagNameNS(REL_NS, 'Relationship')].map((relationship) => Number(relationship.getAttribute('Id').replace(/^rId/, '')) || 0))
	oldSlideRelations.forEach((relationship) => relationship.remove())
	while (slideList.firstChild) slideList.removeChild(slideList.firstChild)
	const existingSlideNames = Object.keys(zip.files).map((path) => Number(path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1] || 0))
	let nextSlidePart = Math.max(0, ...existingSlideNames) + 1
	let nextRelationId = maxRelId + 1
	const layoutTarget = await findLayoutTarget(zip, deck.slides)
	const typesRoot = contentTypes.documentElement
	const existingOverrides = new Set([...contentTypes.getElementsByTagNameNS(CT_NS, 'Override')].map((item) => item.getAttribute('PartName')))
	for (let index = 0; index < deck.slides.length; index += 1) {
		const slide = deck.slides[index]
		const sourcePart = slide.sourcePart || slide.sourcePartCopy
		let part = slide.sourcePart
		let slideXml
		if (sourcePart && zip.file(sourcePart)) {
			slideXml = await zip.file(sourcePart).async('string')
			if (slide.sourcePartCopy) {
				part = `ppt/slides/slide${nextSlidePart}.xml`
				nextSlidePart += 1
				const sourceRels = sourcePart.replace(/\/([^/]+)\.xml$/, '/_rels/$1.xml.rels')
				const destinationRels = part.replace(/\/([^/]+)\.xml$/, '/_rels/$1.xml.rels')
				if (zip.file(sourceRels)) zip.file(destinationRels, await zip.file(sourceRels).async('string'))
				const overridePath = `/${part}`
				if (!existingOverrides.has(overridePath)) {
					const override = contentTypes.createElementNS(CT_NS, 'Override')
					override.setAttribute('PartName', overridePath)
					override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml')
					typesRoot.appendChild(override)
					existingOverrides.add(overridePath)
				}
			}
			const titleStyle = slide.titleStyleDirty ? slide.titleStyle : null
			const bodyStyle = slide.bodyStyleDirty ? slide.bodyStyle : null
			if (slide.titleShapeIndex == null && slide.title.trim()) slideXml = appendTextShape(slideXml, 'S19 title', slide.title, 'title', slide.titleStyle || defaultTextStyle('title', deck.theme))
			else {
				slideXml = updateXmlShape(slideXml, slide.titleShapeIndex, slide.title, titleStyle)
				if (slide.titlePositionDirty) slideXml = updateXmlShapePosition(slideXml, slide.titleShapeIndex, slide.titlePosition)
			}
			if (slide.bodyShapeIndex == null && slide.body.trim()) slideXml = appendTextShape(slideXml, 'S19 body', slide.body, 'body', slide.bodyStyle || defaultTextStyle('body', deck.theme))
			else {
				slideXml = updateXmlShape(slideXml, slide.bodyShapeIndex, slide.body, bodyStyle)
				if (slide.bodyPositionDirty) slideXml = updateXmlShapePosition(slideXml, slide.bodyShapeIndex, slide.bodyPosition)
			}
			for (const shape of slide.extraTextShapes || []) slideXml = updateXmlShape(slideXml, shape.shapeIndex, shape.text, shape.styleDirty ? shape.style : null)
			for (const block of slide.textBlocks || []) slideXml = appendTextShape(slideXml, 'S19 text box', block.text, block.position, block.style || defaultTextStyle('body', deck.theme))
		} else {
			part = `ppt/slides/slide${nextSlidePart}.xml`
			const number = nextSlidePart
			nextSlidePart += 1
			slideXml = buildSlideXml(slide, deck.theme)
			zip.file(`ppt/slides/_rels/slide${number}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${R_NS}/slideLayout" Target="${escapeXml(layoutTarget)}"/></Relationships>`)
			const overridePath = `/${part}`
			if (!existingOverrides.has(overridePath)) {
				const override = contentTypes.createElementNS(CT_NS, 'Override')
				override.setAttribute('PartName', overridePath)
				override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml')
				typesRoot.appendChild(override)
				existingOverrides.add(overridePath)
			}
		}
		zip.file(part, slideXml)
		const relationshipId = `rId${nextRelationId++}`
		const relationship = rels.createElementNS(REL_NS, 'Relationship')
		relationship.setAttribute('Id', relationshipId)
		relationship.setAttribute('Type', `${R_NS}/slide`)
		relationship.setAttribute('Target', part.replace(/^ppt\//, ''))
		relationRoot.appendChild(relationship)
		const id = presentation.createElementNS(P_NS, 'p:sldId')
		id.setAttribute('id', String(256 + index))
		id.setAttributeNS(R_NS, 'r:id', relationshipId)
		slideList.appendChild(id)
	}
	zip.file(presentationPath, new XMLSerializer().serializeToString(presentation))
	zip.file(presentationRelsPath, new XMLSerializer().serializeToString(rels))
	zip.file(contentTypesPath, new XMLSerializer().serializeToString(contentTypes))
}

async function findLayoutTarget(zip, slides) {
	const firstSource = slides.find((slide) => slide.sourcePart)?.sourcePart
	if (firstSource) {
		const filename = firstSource.split('/').pop()
		const relsPath = `${firstSource.slice(0, firstSource.lastIndexOf('/'))}/_rels/${filename}.rels`
		const relsFile = zip.file(relsPath)
		if (relsFile) {
			const rels = readRelationships(await relsFile.async('string'))
			const layout = rels.find((item) => item.type.endsWith('/slideLayout'))
			if (layout) return layout.target
		}
	}
	return '../slideLayouts/slideLayout1.xml'
}

function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = filename
	anchor.click()
	window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function PresentationStudio() {
	const featureAccess = useFeatureAccess('presentation')
	const importInputRef = useRef(null)
	const canvasRef = useRef(null)
	const dragStateRef = useRef(null)
	const sourceArchiveRef = useRef(null)
	const sourceArchiveIdRef = useRef('')
	const [initialDeck] = useState(getSavedDeck)
	const [deck, setDeck] = useState(initialDeck)
	const [deckLibrary, setDeckLibrary] = useState(getSavedLibrary)
	const [activeSlideId, setActiveSlideId] = useState(initialDeck.slides[0]?.id)
	const [saveState, setSaveState] = useState('saved')
	const [notice, setNotice] = useState('')
	const [isWorking, setIsWorking] = useState(false)
	const [formatTarget, setFormatTarget] = useState('')
	const [newSlideLayout, setNewSlideLayout] = useState('title-content')
	const activeIndex = Math.max(0, deck.slides.findIndex((slide) => slide.id === activeSlideId))
	const activeSlide = deck.slides[activeIndex]
	const colors = THEME_COLORS[deck.theme] || THEME_COLORS.indigo
	const extraFormatIndex = formatTarget.startsWith('extra:') ? Number(formatTarget.slice(6)) : null
	const extraFormatShape = activeSlide?.extraTextShapes?.find((shape) => shape.shapeIndex === extraFormatIndex)
	const blockFormatId = formatTarget.startsWith('block:') ? formatTarget.slice(6) : null
	const selectedBlock = activeSlide?.textBlocks?.find((block) => block.id === blockFormatId)
	const selectedStyle = formatTarget === 'title' || !formatTarget
		? activeSlide?.titleStyle || defaultTextStyle('title', deck.theme)
		: formatTarget === 'body'
			? activeSlide?.bodyStyle || defaultTextStyle('body', deck.theme)
			: blockFormatId ? selectedBlock?.style || defaultTextStyle('body', deck.theme) : extraFormatShape?.style || defaultTextStyle('body', deck.theme)
	const textPreviewStyle = (style) => ({ fontSize: `${Number(style.fontSize || 18) * 4 / 3}px`, color: style.color, fontFamily: style.fontFamily, fontWeight: style.bold ? 800 : 500, fontStyle: style.italic ? 'italic' : 'normal', textDecoration: style.underline ? 'underline' : 'none', textAlign: style.align })

	useEffect(() => {
		if (!deck.slides.length) return undefined
		const savingTimer = window.setTimeout(() => setSaveState('saving'), 0)
		const timer = window.setTimeout(() => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(deck))
				const savedLibrary = getSavedLibrary().filter((item) => item.id !== deck.id)
				const nextLibrary = [deck, ...savedLibrary].slice(0, 20)
				localStorage.setItem(LIBRARY_KEY, JSON.stringify(nextLibrary))
				setDeckLibrary(nextLibrary)
				setSaveState('saved')
			} catch {
				setSaveState('unavailable')
			}
		}, 350)
		return () => {
			window.clearTimeout(savingTimer)
			window.clearTimeout(timer)
		}
	}, [deck])

	useEffect(() => {
		if (!deck.imported || !deck.sourceId || sourceArchiveIdRef.current === deck.sourceId) return undefined
		let isCurrent = true
		sourceArchiveRef.current = null
		sourceArchiveIdRef.current = ''
		readSourceFile(deck.sourceId)
			.then((source) => {
				if (!source) throw new Error('The original PowerPoint source is unavailable.')
				return JSZip.loadAsync(source)
			})
			.then((zip) => {
				if (!isCurrent || !zip) return
				sourceArchiveRef.current = zip
				sourceArchiveIdRef.current = deck.sourceId
			})
			.catch(() => { if (isCurrent) setNotice('Re-import this PowerPoint to preserve its original layout and images.') })
		return () => { isCurrent = false }
	}, [deck.imported, deck.sourceId])

	function updateActiveSlide(field, value) {
		setDeck((current) => ({
			...current,
			slides: current.slides.map((slide) => slide.id === activeSlideId ? { ...slide, [field]: value } : slide),
		}))
	}

	function startTextDrag(event, field) {
		if (!canvasRef.current) return
		event.preventDefault()
		canvasRef.current.setPointerCapture(event.pointerId)
		const textBox = event.currentTarget.parentElement.getBoundingClientRect()
		dragStateRef.current = { field, pointerId: event.pointerId, offsetX: event.clientX - textBox.left, offsetY: event.clientY - textBox.top }
	}

	function moveTextDrag(event) {
		const drag = dragStateRef.current
		const bounds = canvasRef.current?.getBoundingClientRect()
		if (!drag || drag.pointerId !== event.pointerId || !bounds) return
		const maxX = 90
		const maxY = 88
		const x = Math.max(2, Math.min(maxX, ((event.clientX - bounds.left - drag.offsetX) / bounds.width) * 100))
		const y = Math.max(3, Math.min(maxY, ((event.clientY - bounds.top - drag.offsetY) / bounds.height) * 100))
		setDeck((current) => ({
			...current,
			slides: current.slides.map((slide) => {
				if (slide.id !== activeSlideId) return slide
				if (drag.field.startsWith('block:')) return { ...slide, textBlocks: (slide.textBlocks || []).map((block) => block.id === drag.field.slice(6) ? { ...block, position: { x, y } } : block) }
				return { ...slide, [`${drag.field}Position`]: { x, y }, [`${drag.field}PositionDirty`]: true }
			}),
		}))
	}

	function addTextBlock() {
		const block = { id: createId(), text: 'Write something…', position: { x: 20, y: 36 }, style: defaultTextStyle('body', deck.theme) }
		setDeck((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === activeSlideId ? { ...slide, textBlocks: [...(slide.textBlocks || []), block] } : slide) }))
		setFormatTarget(`block:${block.id}`)
	}

	function updateTextBlock(blockId, text) {
		setDeck((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === activeSlideId ? { ...slide, textBlocks: (slide.textBlocks || []).map((block) => block.id === blockId ? { ...block, text } : block) } : slide) }))
	}

	function removeTextBlock(blockId) {
		setDeck((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === activeSlideId ? { ...slide, textBlocks: (slide.textBlocks || []).filter((block) => block.id !== blockId) } : slide) }))
		setFormatTarget('body')
	}

	function updateExtraShape(shapeIndex, value) {
		setDeck((current) => ({
			...current,
			slides: current.slides.map((slide) => slide.id === activeSlideId
				? { ...slide, extraTextShapes: (slide.extraTextShapes || []).map((shape) => shape.shapeIndex === shapeIndex ? { ...shape, text: value } : shape) }
				: slide),
		}))
	}

	function updateTextStyle(property, value) {
		setDeck((current) => ({
			...current,
			slides: current.slides.map((slide) => {
				if (slide.id !== activeSlideId) return slide
				if (formatTarget === 'title') return { ...slide, titleStyle: { ...(slide.titleStyle || defaultTextStyle('title', current.theme)), [property]: value }, titleStyleDirty: true }
				if (formatTarget === 'body') return { ...slide, bodyStyle: { ...(slide.bodyStyle || defaultTextStyle('body', current.theme)), [property]: value }, bodyStyleDirty: true }
				if (blockFormatId) return { ...slide, textBlocks: (slide.textBlocks || []).map((block) => block.id === blockFormatId ? { ...block, style: { ...(block.style || defaultTextStyle('body', current.theme)), [property]: value } } : block) }
				return { ...slide, extraTextShapes: (slide.extraTextShapes || []).map((shape) => shape.shapeIndex === extraFormatIndex ? { ...shape, style: { ...(shape.style || defaultTextStyle('body', current.theme)), [property]: value }, styleDirty: true } : shape) }
			}),
		}))
	}

	function addSlide(layout = newSlideLayout) {
		const slide = makeSlide(
			layout === 'blank' ? '' : layout === 'title-slide' ? 'Presentation title' : 'New slide',
			layout === 'title-slide' ? 'Add a subtitle' : 'Add your ideas here.',
			layout,
		)
		setDeck((current) => ({ ...current, slides: [...current.slides, slide] }))
		setActiveSlideId(slide.id)
		setFormatTarget('title')
		setNotice('Slide added.')
	}

	function applySlideLayout(layout) {
		if (!activeSlide || deck.imported || !SLIDE_LAYOUTS.some((item) => item.id === layout)) return
		setDeck((current) => ({
			...current,
			slides: current.slides.map((slide) => {
				if (slide.id !== activeSlideId) return slide
				const layoutSlide = makeSlide(slide.title || 'New slide', slide.body || 'Add your ideas here.', layout)
				return {
					...slide,
					layout,
					title: layout === 'blank' ? slide.title : (slide.title || 'New slide'),
					body: ['blank', 'two-column'].includes(layout) ? slide.body : (slide.body || 'Add your ideas here.'),
					titlePosition: layoutSlide.titlePosition,
					bodyPosition: layoutSlide.bodyPosition,
					textBlocks: layout === 'two-column' && !slide.textBlocks?.length
						? layoutSlide.textBlocks.map((block, index) => ({ ...block, text: index === 0 && slide.body ? slide.body : block.text }))
						: slide.textBlocks,
				}
			}),
		}))
		setNotice(`${SLIDE_LAYOUTS.find((item) => item.id === layout)?.label} layout applied.`)
	}

	function duplicateActiveSlide() {
		if (!activeSlide) return
		const copy = {
			...activeSlide,
			id: createId(),
			sourcePart: null,
			sourcePartCopy: activeSlide.sourcePart || activeSlide.sourcePartCopy || null,
			textBlocks: (activeSlide.textBlocks || []).map((block) => ({ ...block, id: createId(), position: { ...block.position }, style: block.style ? { ...block.style } : block.style })),
			extraTextShapes: (activeSlide.extraTextShapes || []).map((shape) => ({ ...shape, style: shape.style ? { ...shape.style } : shape.style })),
			titlePosition: { ...activeSlide.titlePosition },
			bodyPosition: { ...activeSlide.bodyPosition },
		}
		const next = [...deck.slides]
		next.splice(activeIndex + 1, 0, copy)
		setDeck((current) => ({ ...current, slides: next }))
		setActiveSlideId(copy.id)
		setNotice('Slide duplicated.')
	}

	function moveActiveSlide(offset) {
		const destination = activeIndex + offset
		if (destination < 0 || destination >= deck.slides.length) return
		const next = [...deck.slides]
		const [slide] = next.splice(activeIndex, 1)
		next.splice(destination, 0, slide)
		setDeck((current) => ({ ...current, slides: next }))
	}

	function removeActiveSlide() {
		if (deck.slides.length === 1) {
			setNotice('A presentation must contain at least one slide.')
			return
		}
		const hasContent = Boolean(activeSlide?.title?.trim() || activeSlide?.body?.trim() || activeSlide?.textBlocks?.some((block) => block.text?.trim()) || activeSlide?.extraTextShapes?.some((shape) => shape.text?.trim()))
		if (hasContent && !window.confirm(`Delete “${activeSlide.title || `Slide ${activeIndex + 1}`}”? This slide contains content.`)) return
		const next = deck.slides.filter((slide) => slide.id !== activeSlideId)
		setDeck((current) => ({ ...current, slides: next }))
		setActiveSlideId(next[Math.max(0, activeIndex - 1)].id)
		setNotice('Slide removed.')
	}

	async function importPowerPoint(event) {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		if (!file.name.toLowerCase().endsWith('.pptx')) {
			setNotice('Choose a PowerPoint .pptx file.')
			return
		}
		if (file.size > 50 * 1024 * 1024) {
			setNotice('Choose a .pptx file smaller than 50 MB.')
			return
		}
		setIsWorking(true)
		setNotice('Opening PowerPoint…')
		try {
			const source = await file.arrayBuffer()
			const zip = await JSZip.loadAsync(source)
			const slides = await readPresentation(zip)
			const sourceId = createId()
			const nextDeck = {
				id: createId(),
				title: file.name.replace(/\.pptx$/i, ''),
				theme: 'indigo',
				imported: true,
				sourceId,
				slides,
			}
			await storeSourceFile(sourceId, source).catch(() => undefined)
			sourceArchiveRef.current = zip
			sourceArchiveIdRef.current = sourceId
			setDeck(nextDeck)
			setActiveSlideId(slides[0].id)
			setNotice(`Opened ${slides.length} slides. Existing slide layout and media are preserved when you export.`)
		} catch (error) {
			setNotice(error.message || 'This PowerPoint file could not be opened.')
		} finally {
			setIsWorking(false)
		}
	}

	function startNewDeck() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(deck))
			const savedLibrary = [deck, ...getSavedLibrary().filter((item) => item.id !== deck.id)].slice(0, 20)
			localStorage.setItem(LIBRARY_KEY, JSON.stringify(savedLibrary))
			setDeckLibrary(savedLibrary)
		} catch {
			// The new deck can still be created when browser storage is full.
		}
		const nextDeck = makeDeck()
		sourceArchiveRef.current = null
		sourceArchiveIdRef.current = ''
		setDeck(nextDeck)
		setActiveSlideId(nextDeck.slides[0].id)
		setNotice('New presentation created. Changes save in this browser automatically.')
	}

	function openSavedDeck(deckId) {
		const saved = deckLibrary.find((item) => item.id === deckId)
		if (!saved || saved.id === deck.id) return
		if (!saved.imported) {
			sourceArchiveRef.current = null
			sourceArchiveIdRef.current = ''
		}
		setDeck(saved)
		setActiveSlideId(saved.slides[0]?.id)
		setNotice(saved.imported ? 'Opening the saved PowerPoint source…' : 'Presentation opened.')
	}

	async function exportPowerPoint() {
		if (!featureAccess.allowed) {
			setNotice('An active plan with Presentation Studio exports enabled is required to download this deck.')
			return
		}
		setIsWorking(true)
		setNotice('Preparing your PowerPoint…')
		try {
			let zip
			if (deck.imported) {
				if (!sourceArchiveRef.current) throw new Error('Re-import the original .pptx to preserve its layout before exporting.')
				const sourceCopy = await sourceArchiveRef.current.generateAsync({ type: 'arraybuffer' })
				zip = await JSZip.loadAsync(sourceCopy)
				await updateImportedArchive(zip, deck)
			} else {
				zip = createPptxArchive(deck)
			}
			const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
			const filename = `${(deck.title.trim() || 'presentation').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}.pptx`
			downloadBlob(blob, filename)
			setNotice('PowerPoint downloaded.')
		} catch (error) {
			setNotice(error.message || 'The PowerPoint could not be exported.')
		} finally {
			setIsWorking(false)
		}
	}

	return (
		<main className="dashboard-layout presentation-studio-layout">
			<WorkspaceHeader active="/presentation" />
			<section className="dashboard-content">
				<div className="presentation-studio-main">
					<div className="presentation-studio-heading">
						<div><p className="dashboard-eyebrow">SLIDE WORKSPACE</p><h1>Presentation Studio</h1><p>Create a new deck or import a PowerPoint to edit its text.</p></div>
						<div className="presentation-studio-actions">
							<button className="presentation-secondary-button" type="button" onClick={startNewDeck}>＋ New deck</button>
							<input ref={importInputRef} className="presentation-hidden-input" type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={importPowerPoint} />
							<button className="presentation-secondary-button" type="button" onClick={() => importInputRef.current?.click()} disabled={isWorking}>Open .pptx</button>
							<button className="presentation-export-button" type="button" onClick={exportPowerPoint} disabled={isWorking || !featureAccess.allowed}>{isWorking ? 'Working…' : 'Export .pptx'}</button>
						</div>
					</div>

					<div className="presentation-meta-row">
						<label className="presentation-name-field"><span>Presentation name</span><input value={deck.title} maxLength="100" onChange={(event) => setDeck((current) => ({ ...current, title: event.target.value }))} /></label>
						{deckLibrary.length > 1 && <label className="presentation-library-field"><span>Open</span><select value={deck.id} onChange={(event) => openSavedDeck(event.target.value)}><option value={deck.id}>{deck.title}</option>{deckLibrary.filter((item) => item.id !== deck.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
						{deck.imported ? <span className="presentation-file-status">POWERPOINT · {deck.slides.length} SLIDES</span> : <label className="presentation-theme-field"><span>Theme</span><select value={deck.theme} onChange={(event) => setDeck((current) => ({ ...current, theme: event.target.value }))}><option value="indigo">Indigo</option><option value="ocean">Ocean</option><option value="charcoal">Charcoal</option></select></label>}
						<span className="presentation-save-status">{deck.imported ? 'Original layout kept' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved in this browser' : 'Browser storage unavailable'}</span>
					</div>

					{notice && <p className="presentation-notice" role="status">{notice}</p>}
					<FeatureAccessNotice access={featureAccess} featureName="Presentation Studio exports" />

					<div className="presentation-editor">
						<aside className="presentation-slide-list" aria-label="Slides">
							<div className="presentation-slide-list-heading"><span>Slides</span><span>{String(deck.slides.length).padStart(2, '0')}</span></div>
							{deck.slides.map((slide, index) => (
								<button type="button" key={slide.id} className={`presentation-slide-thumb${slide.id === activeSlideId ? ' active' : ''}`} onClick={() => setActiveSlideId(slide.id)} aria-current={slide.id === activeSlideId ? 'true' : undefined}>
									<span className="presentation-slide-thumb-canvas" style={{ '--slide-background': deck.imported ? '#f4f5f8' : slide.background || `#${colors.background}`, '--slide-ink': deck.imported ? '#263247' : `#${colors.ink}` }}><b>{slide.title || 'Untitled slide'}</b><i>{slide.body || slide.textBlocks?.[0]?.text || 'Add slide text'}</i></span>
									<span className="presentation-slide-thumb-label"><span>{String(index + 1).padStart(2, '0')}</span>{slide.title || 'Untitled slide'}</span>
								</button>
							))}
							<label className="presentation-layout-field"><span>New slide layout</span><select value={newSlideLayout} onChange={(event) => setNewSlideLayout(event.target.value)}>{SLIDE_LAYOUTS.map((layout) => <option key={layout.id} value={layout.id}>{layout.label}</option>)}</select></label>
							<button className="presentation-add-slide" type="button" onClick={() => addSlide()}>＋ Add slide</button>
						</aside>

						<section className="presentation-stage" aria-label={`Editing slide ${activeIndex + 1}`}>
							<div className="presentation-stage-toolbar"><span>SLIDE {String(activeIndex + 1).padStart(2, '0')} <i>/</i> {String(deck.slides.length).padStart(2, '0')}</span><div><button type="button" onClick={() => moveActiveSlide(-1)} disabled={activeIndex === 0} aria-label="Move slide earlier" title="Move earlier">↑</button><button type="button" onClick={() => moveActiveSlide(1)} disabled={activeIndex === deck.slides.length - 1} aria-label="Move slide later" title="Move later">↓</button><button type="button" onClick={() => setActiveSlideId(deck.slides[Math.max(0, activeIndex - 1)].id)} disabled={activeIndex === 0} aria-label="Previous slide">←</button><button type="button" onClick={() => setActiveSlideId(deck.slides[Math.min(deck.slides.length - 1, activeIndex + 1)].id)} disabled={activeIndex === deck.slides.length - 1} aria-label="Next slide">→</button><button type="button" onClick={duplicateActiveSlide} aria-label="Duplicate current slide" title="Duplicate slide">Duplicate</button><button type="button" className="presentation-remove-slide" onClick={removeActiveSlide} aria-label="Remove current slide">Remove slide</button></div></div>
							<div className="presentation-text-toolbar" aria-label="Text formatting">
								<button className="presentation-insert-text" type="button" onClick={addTextBlock}>＋ Insert text box</button>
								<label><span>Layout</span><select value={deck.imported ? 'imported' : activeSlide?.layout || 'title-content'} onChange={(event) => applySlideLayout(event.target.value)} disabled={deck.imported}><option value="imported" disabled>Imported</option>{SLIDE_LAYOUTS.map((layout) => <option key={layout.id} value={layout.id}>{layout.label}</option>)}</select></label>
								{!deck.imported && <label className="presentation-color-control"><span>Slide background</span><input type="color" aria-label="Slide background color" value={activeSlide?.background || `#${colors.background}`} onChange={(event) => updateActiveSlide('background', event.target.value)} /></label>}
								<label><span>Text box</span><select value={formatTarget || 'title'} onChange={(event) => setFormatTarget(event.target.value)}><option value="title">Slide title</option><option value="body">Slide body</option>{(activeSlide?.textBlocks || []).map((block, index) => <option key={block.id} value={`block:${block.id}`}>Text box {index + 1}</option>)}{(activeSlide?.extraTextShapes || []).map((shape, index) => <option key={shape.shapeIndex} value={`extra:${shape.shapeIndex}`}>Other text {index + 1}</option>)}</select></label>
								<label><span>Font</span><select value={selectedStyle.fontFamily} onChange={(event) => updateTextStyle('fontFamily', event.target.value)}><option>Aptos</option><option>Aptos Display</option><option>Arial</option><option>Georgia</option><option>Inter</option><option>Verdana</option></select></label>
								<label><span>Size</span><select value={selectedStyle.fontSize} onChange={(event) => updateTextStyle('fontSize', Number(event.target.value))}>{[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 56, 64, 72].map((size) => <option key={size} value={size}>{size} pt</option>)}</select></label>
								<label className="presentation-color-control"><span>Color</span><input type="color" aria-label="Text color" value={/^#[0-9a-f]{6}$/i.test(selectedStyle.color) ? selectedStyle.color : '#202642'} onChange={(event) => updateTextStyle('color', event.target.value)} /></label>
								<div className="presentation-style-toggles"><button type="button" className={selectedStyle.bold ? 'selected' : ''} aria-label="Bold" aria-pressed={Boolean(selectedStyle.bold)} onClick={() => updateTextStyle('bold', !selectedStyle.bold)}><b>B</b></button><button type="button" className={selectedStyle.italic ? 'selected' : ''} aria-label="Italic" aria-pressed={Boolean(selectedStyle.italic)} onClick={() => updateTextStyle('italic', !selectedStyle.italic)}><i>I</i></button><button type="button" className={selectedStyle.underline ? 'selected' : ''} aria-label="Underline" aria-pressed={Boolean(selectedStyle.underline)} onClick={() => updateTextStyle('underline', !selectedStyle.underline)}><u>U</u></button></div>
								<label><span>Align</span><select value={selectedStyle.align} onChange={(event) => updateTextStyle('align', event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
							</div>
							<div ref={canvasRef} className={`presentation-canvas${deck.theme === 'charcoal' && !deck.imported ? ' charcoal' : ''}`} onPointerMove={moveTextDrag} onPointerUp={() => { dragStateRef.current = null }} onPointerCancel={() => { dragStateRef.current = null }} style={deck.imported ? undefined : { '--slide-background': activeSlide?.background || `#${colors.background}`, '--slide-ink': `#${colors.ink}`, '--slide-accent': `#${colors.accent}` }}>
								{(deck.imported || activeSlide?.layout !== 'blank') && <label className="presentation-title-edit" style={{ left: `${activeSlide?.titlePosition?.x ?? 8}%`, top: `${activeSlide?.titlePosition?.y ?? 23}%`, width: `min(78%, calc(100% - ${activeSlide?.titlePosition?.x ?? 8}% - 4%))` }}>{formatTarget === 'title' && <button className="presentation-drag-handle" type="button" aria-label="Move slide title" title="Drag to move" onPointerDown={(event) => startTextDrag(event, 'title')}>⠿ Move</button>}<span className="sr-only">Slide title</span><textarea style={textPreviewStyle(activeSlide?.titleStyle || defaultTextStyle('title', deck.theme))} rows="2" value={activeSlide?.title || ''} maxLength="180" placeholder="Add a slide title" onFocus={() => setFormatTarget('title')} onChange={(event) => updateActiveSlide('title', event.target.value)} /></label>}
								{!['blank', 'two-column'].includes(activeSlide?.layout) && <><div className="presentation-slide-rule" /><label className="presentation-body-edit" style={{ left: `${activeSlide?.bodyPosition?.x ?? 8}%`, top: `${activeSlide?.bodyPosition?.y ?? 54}%`, width: `min(78%, calc(100% - ${activeSlide?.bodyPosition?.x ?? 8}% - 4%))` }}>{formatTarget === 'body' && <button className="presentation-drag-handle" type="button" aria-label="Move slide body" title="Drag to move" onPointerDown={(event) => startTextDrag(event, 'body')}>⠿ Move</button>}<span className="sr-only">Slide body</span><textarea style={textPreviewStyle(activeSlide?.bodyStyle || defaultTextStyle('body', deck.theme))} value={activeSlide?.body || ''} maxLength="2400" placeholder="Add supporting details, one idea per line" onFocus={() => setFormatTarget('body')} onChange={(event) => updateActiveSlide('body', event.target.value)} /></label></>}
								{(activeSlide?.textBlocks || []).map((block, index) => <div key={block.id} className={`presentation-text-block${formatTarget === `block:${block.id}` ? ' selected' : ''}`} style={{ left: `${block.position?.x ?? 20}%`, top: `${block.position?.y ?? 36}%`, width: `${block.width ?? 52}%` }} onFocusCapture={() => setFormatTarget(`block:${block.id}`)}><div className="presentation-text-block-controls">{formatTarget === `block:${block.id}` && <button className="presentation-drag-handle" type="button" aria-label={`Move text box ${index + 1}`} title="Drag to move" onPointerDown={(event) => startTextDrag(event, `block:${block.id}`)}>⠿ Move</button>}<button className="presentation-delete-block" type="button" aria-label={`Delete text box ${index + 1}`} onClick={() => removeTextBlock(block.id)}>×</button></div><textarea aria-label={`Text box ${index + 1}`} style={textPreviewStyle(block.style || defaultTextStyle('body', deck.theme))} value={block.text} maxLength="2400" onChange={(event) => updateTextBlock(block.id, event.target.value)} /></div>)}
								<span className="presentation-slide-brand">S19 PRESENTATION STUDIO</span>
							</div>
							{deck.imported && activeSlide?.extraTextShapes?.length > 0 && <section className="presentation-extra-text" aria-label="Other editable slide text"><h3>Other slide text</h3>{activeSlide.extraTextShapes.map((shape, index) => <label key={shape.shapeIndex}><span>Text box {index + 1}</span><textarea style={textPreviewStyle(shape.style || defaultTextStyle('body', deck.theme))} value={shape.text} maxLength="2400" onFocus={() => setFormatTarget(`extra:${shape.shapeIndex}`)} onChange={(event) => updateExtraShape(shape.shapeIndex, event.target.value)} /></label>)}</section>}
							<p className="presentation-format-note">Drag a Move handle to reposition a text box. Choose a text box to adjust its font, size, color, emphasis, and alignment. Imported PowerPoints keep their images and layout on export.</p>
						</section>
					</div>
				</div>
			</section>
		</main>
	)
}

export default PresentationStudio
