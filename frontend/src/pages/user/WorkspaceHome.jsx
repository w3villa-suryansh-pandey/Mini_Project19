import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import WorkspaceHeader from '../../components/WorkspaceHeader.jsx'
import { getUserProfile } from '../../services/api.js'
import pdfWorkspaceImage from '../../assets/Modern PDF Editing Workspace.png'

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

	useEffect(() => {
		let isCurrent = true
		getUserProfile()
			.then(({ profile }) => {
				const name = profile?.name?.trim()?.split(/\s+/)?.[0]
				if (isCurrent && name) setFirstName(name)
			})
			.catch(() => undefined)
		return () => { isCurrent = false }
	}, [])

	return (
		<main className="dashboard-layout workspace-home-layout">
			<WorkspaceHeader />
			<section className="dashboard-content">
				<div className="workspace-home-main">
					<section className="workspace-home-intro dashboard-welcome" aria-labelledby="workspace-home-title">
						<div className="workspace-home-intro-copy">
							<p className="dashboard-eyebrow">YOUR S19 WORKSPACE</p>
							<h1 id="workspace-home-title">Welcome, {firstName}</h1>
							<p>Make your documents work harder. Edit PDFs, organize files, and create polished work from one simple space.</p>
							<Link className="workspace-home-primary-action" to="/editor">Open PDF editor <span aria-hidden="true">↗</span></Link>
						</div>
					</section>

					<section className="workspace-home-showcase" aria-label="PDF editing workspace preview">
						<div className="workspace-home-visual">
							<img src={pdfWorkspaceImage} alt="A modern PDF editing workspace with tools for editing text, adding images, erasing content, and signing" />
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
