import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import WorkspaceHeader from '../../components/WorkspaceHeader.jsx'
import { getUserProfile } from '../../services/api.js'

const destinations = [
	{ title: 'Dashboard', description: 'See your workspace at a glance and jump back into your recent tools.', href: '/dashboard', icon: 'dashboard', label: 'Open dashboard', tone: 'violet' },
	{ title: 'PDF Editor', description: 'Edit PDF text, organize pages, add annotations, and prepare documents to share.', href: '/editor', icon: 'pdf', label: 'Edit a PDF', tone: 'indigo' },
	{ title: 'Presentation Studio', description: 'Build slide decks from scratch or import a PowerPoint to make edits.', href: '/presentation', icon: 'presentation', label: 'Create a presentation', tone: 'blue' },
	{ title: 'Writing Pad', description: 'Write and format documents, then export your finished work.', href: '/writing-pad', icon: 'writing', label: 'Start writing', tone: 'pink' },
	{ title: 'Image Tools', description: 'Prepare images, make passport photos, and remove backgrounds.', href: '/image-tools', icon: 'image', label: 'Open image tools', tone: 'cyan' },
	{ title: 'File Converter', description: 'Convert supported document and image files into the format you need.', href: '/converter', icon: 'convert', label: 'Convert a file', tone: 'teal' },
	{ title: 'File Compressor', description: 'Reduce PDF and image file sizes for easier storage and sharing.', href: '/compressor', icon: 'compress', label: 'Compress a file', tone: 'orange' },
	{ title: 'Plans', description: 'Review available plans and choose the option that fits your PDF workflow.', href: '/pricing', icon: 'plans', label: 'View plans', tone: 'gold' },
	{ title: 'Account Settings', description: 'Update your profile details and manage your account preferences.', href: '/profile', icon: 'account', label: 'Manage account', tone: 'slate' },
]

const workflowSteps = [
	{ title: 'Choose Your Tool', description: 'Choose the right tool for your task, from PDF editing and merging to compression, conversion, and more.', icon: 'tools' },
	{ title: 'Upload Your File', description: 'Upload a document from your device using our simple drag-and-drop workflow.', icon: 'upload' },
	{ title: 'Edit & Customize', description: 'Make changes, adjust your document, apply your chosen operation, and preview the result.', icon: 'edit' },
	{ title: 'Download Your Final File', description: 'Download your finished document in the supported format and get on with your work.', icon: 'download' },
]

function HomeIcon({ name }) {
	const paths = {
		dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="8" height="7" rx="1.5" /></>,
		pdf: <><path d="M7 3.5h7l4 4V21H7z" /><path d="M14 3.5v4h4M9.5 13h5M9.5 16h5" /></>,
		presentation: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21l4-4 4 4M12 17v4M7 9h4m-4 4h10" /></>,
		writing: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /><path d="m17 16 3 3" /></>,
		image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m5 17 4-4 3 3 3-4 4 5" /></>,
		convert: <><path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" /></>,
		compress: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
		plans: <><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="8" cy="6" r="1" /><circle cx="16" cy="12" r="1" /></>,
		account: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5" /></>,
	}
	return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function WorkflowIcon({ name }) {
	const paths = {
		tools: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
		upload: <><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
		edit: <><path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4M12 20h8" /></>,
		download: <><path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5" /><path d="M5 16v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /><path d="m9 19 2 2 4-4" /></>,
	}
	return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function WorkspaceHome() {
	const [firstName, setFirstName] = useState('there')
	const [isReturningUser, setIsReturningUser] = useState(false)
	const [welcomeReady, setWelcomeReady] = useState(false)
	const [welcomeVisitKey, setWelcomeVisitKey] = useState('')
	const [typedHeading, setTypedHeading] = useState('')
	const [typedMessage, setTypedMessage] = useState('')

	useEffect(() => {
		let isCurrent = true
		getUserProfile()
			.then(({ profile }) => {
				const name = profile?.name?.trim()?.split(/\s+/)?.[0]
				if (!isCurrent) return
				if (name) setFirstName(name)
				if (profile?.id) {
					const visitedKey = `s19-workspace-home-seen-${profile.id}`
					try {
						const hasVisited = window.sessionStorage.getItem(visitedKey) === 'true'
						setIsReturningUser(hasVisited)
						if (!hasVisited) setWelcomeVisitKey(visitedKey)
					} catch {
						setIsReturningUser(false)
					}
				}
				setWelcomeReady(true)
			})
			.catch(() => {
				if (isCurrent) setWelcomeReady(true)
			})
		return () => { isCurrent = false }
	}, [])

	const welcomeHeading = `${isReturningUser ? 'Welcome back' : 'Welcome'}, ${firstName}`
	const welcomeMessage = isReturningUser
		? 'Pick up where you left off and make your documents work harder with all your tools in one place.'
		: 'Your workspace is ready. Explore the tools to edit PDFs, organize files, and create polished work.'

	useEffect(() => {
		if (!welcomeReady) return
		const rememberVisit = () => {
			if (welcomeVisitKey) {
				try { window.sessionStorage.setItem(welcomeVisitKey, 'true') } catch { /* storage may be disabled */ }
			}
		}
		if (isReturningUser || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setTypedHeading(welcomeHeading)
			setTypedMessage(welcomeMessage)
			rememberVisit()
			return
		}

		let position = 0
		const interval = window.setInterval(() => {
			position += 1
			setTypedHeading(welcomeHeading.slice(0, position))
			if (position > welcomeHeading.length) {
				setTypedMessage(welcomeMessage.slice(0, position - welcomeHeading.length))
			}
			if (position >= welcomeHeading.length + welcomeMessage.length) {
				window.clearInterval(interval)
				rememberVisit()
			}
		}, 28)
		return () => window.clearInterval(interval)
	}, [welcomeReady, isReturningUser, welcomeVisitKey, welcomeHeading, welcomeMessage])

	return (
		<main className="dashboard-layout workspace-home-layout">
			<WorkspaceHeader />
			<section className="dashboard-content">
				<div className="workspace-home-main">
					<section className="workspace-home-intro dashboard-welcome" aria-labelledby="workspace-home-title">
						<div className="workspace-home-intro-copy">
							<p className="dashboard-eyebrow">YOUR S19 WORKSPACE</p>
							<h1 id="workspace-home-title" aria-label={welcomeHeading}>{typedHeading}{welcomeReady && !isReturningUser && typedMessage.length < welcomeMessage.length && <span className="workspace-welcome-caret" aria-hidden="true" />}{welcomeReady && typedHeading === welcomeHeading && <span className="workspace-welcome-edit-figure" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m14.5 5.5 4 4M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /><path d="M12 20h8" /></svg></span>}</h1>
							<p aria-label={welcomeMessage}>{typedMessage}</p>
						</div>
					</section>

					<section className="workspace-home-showcase" aria-label="PDF editing workspace preview">
						<div className="workspace-home-visual" aria-hidden="true">
							<div className="home-editor-window">
								<div className="home-editor-topbar"><span className="home-editor-dots"><i /><i /><i /></span><span className="home-editor-file">Quarterly-report.pdf</span><span className="home-editor-status"><b /> All changes saved</span></div>
								<div className="home-editor-toolbar"><span className="home-toolbar-brand">S19 <small>PDF Editor</small></span><span className="home-tool-active">↖ <small>Select</small></span><span>▤ <small>Text</small></span><span>✎ <small>Annotate</small></span><span>▧ <small>Image</small></span><span>⇩ <small>Export</small></span><button type="button" tabIndex="-1">Share ↗</button></div>
								<div className="home-editor-body">
									<aside className="home-editor-sidebar"><span className="home-sidebar-heading">PAGES <b>＋</b></span><div className="home-page-thumb selected"><span>01</span><i /><i /><i /><b>01</b></div><div className="home-page-thumb"><span>02</span><i /><i /><i /><b>02</b></div><div className="home-page-thumb"><span>03</span><i /><i /><i /><b>03</b></div></aside>
									<div className="home-editor-canvas"><div className="home-document"><span className="home-document-label">S19  /  BUSINESS REPORT</span><h3>Building better<br />workflows.</h3><p className="home-document-subtitle">Quarterly progress &amp; what comes next</p><div className="home-document-rule" /><div className="home-document-columns"><div><b>01</b><strong>Less busywork</strong><p>Simple tools help teams focus on the work that matters.</p></div><div><b>02</b><strong>More momentum</strong><p>Turn everyday documents into clear next steps.</p></div></div><div className="home-document-chart"><span>YOUR QUARTER AT A GLANCE</span><div><i /><i /><i /><i /><i /><i /><i /><i /></div></div><small className="home-document-footer">S19 WORKSPACE <span>01</span></small></div></div>
									</div>
								</div>
							<div className="home-editor-float home-float-left"><span>✦</span><div><b>Ready when you are</b><small>Your tools, all in one place</small></div></div>
							<div className="home-editor-float home-float-right"><span>✓</span><div><b>Private by design</b><small>Your files stay yours</small></div></div>
						</div>
					</section>

					<section className="workspace-home-how" aria-labelledby="workspace-home-how-title">
						<div className="workspace-home-how-heading">
							<p className="workspace-home-how-eyebrow">HOW IT WORKS</p>
							<h2 id="workspace-home-how-title">From Upload to Results in Just a Few Steps</h2>
							<p>Everything you need to work with your files in one place. Choose a tool, upload your document, make your changes, and download your finished result.</p>
						</div>
						<div className="workspace-home-steps">
							{workflowSteps.map((step, index) => (
								<article className="workspace-home-step" key={step.title}>
									<div className={`workspace-home-step-icon step-tone-${index + 1}`}><WorkflowIcon name={step.icon} /></div>
									<span className={`workspace-home-step-number step-tone-${index + 1}`}>0{index + 1}</span>
									<h3>{step.title}</h3>
									<p>{step.description}</p>
								</article>
							))}
						</div>
					</section>

					<section className="workspace-home-file-tools" aria-labelledby="workspace-file-tools-title">
						<div className="workspace-home-file-tools-heading">
							<p className="dashboard-eyebrow">CONVERT &amp; COMPRESS</p>
							<h2 id="workspace-file-tools-title">Make every file work better.</h2>
							<p>Change formats in a few clicks or shrink large files for easier sharing.</p>
						</div>
						<div className="workspace-home-file-tools-grid">
							<article className="home-file-tool-card home-convert-card" aria-label="File format conversion preview">
								<div className="home-file-tool-card-heading"><span className="home-file-tool-icon">⇄</span><div><small>FILE CONVERTER</small><strong>Switch formats</strong></div><span className="home-file-tool-menu">···</span></div>
								<div className="home-convert-flow"><div className="home-convert-file"><span className="home-format-icon format-docx">W</span><span><b>Project brief</b><small>Word document</small></span><strong>.DOCX</strong></div><span className="home-convert-arrow" aria-hidden="true">→</span><div className="home-convert-file result"><span className="home-format-icon format-pdf">PDF</span><span><b>Project brief</b><small>Ready to share</small></span><strong>.PDF</strong></div></div>
								<div className="home-file-tool-footer"><span><i /> Conversion complete</span><b>Download file ↓</b></div>
							</article>
							<article className="home-file-tool-card home-compress-card" aria-label="File compression preview">
								<div className="home-file-tool-card-heading"><span className="home-file-tool-icon compress-icon">⌁</span><div><small>FILE COMPRESSOR</small><strong>Keep files lightweight</strong></div><span className="home-file-tool-menu">···</span></div>
								<div className="home-compress-file"><span className="home-format-icon format-zip">▣</span><span><b>Project-assets.zip</b><small>Optimized for sharing</small></span><span className="home-compress-saved">−64%</span></div>
								<div className="home-compress-sizes"><span><small>ORIGINAL</small><b>24.8 <i>MB</i></b></span><span className="home-size-arrow" aria-hidden="true">→</span><span><small>COMPRESSED</small><b>8.9 <i>MB</i></b></span></div>
								<div className="home-compress-meter"><span /></div>
								<div className="home-file-tool-footer"><span><i /> Quality preserved</span><b>Save space ✦</b></div>
							</article>
						</div>
					</section>

					<section className="workspace-home-directory" aria-labelledby="workspace-home-directory-title">
						<div className="workspace-home-section-heading">
							<div><p className="dashboard-eyebrow">EXPLORE YOUR WORKSPACE</p><h2 id="workspace-home-directory-title">What would you like to do?</h2></div>
							<span>{destinations.length} workspaces</span>
						</div>
						<div className="workspace-home-grid">
							{destinations.map((item) => (
								<Link className={`workspace-home-card tone-${item.tone}`} to={item.href} key={item.href}>
									<span className="workspace-home-card-icon"><HomeIcon name={item.icon} /></span>
									<span className="workspace-home-card-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
									<span className="workspace-home-card-action">{item.label}<b aria-hidden="true">↗</b></span>
								</Link>
							))}
						</div>
					</section>
					<p className="workspace-home-privacy"><span aria-hidden="true">✦</span> Your files are processed privately in your browser.</p>
				</div>
			</section>
		</main>
	)
}

export default WorkspaceHome
