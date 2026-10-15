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
					<section className="workspace-home-intro" aria-labelledby="workspace-home-title">
						<div>
							<p className="dashboard-eyebrow">YOUR S19 WORKSPACE</p>
							<h1 id="workspace-home-title">Welcome, {firstName}</h1>
							<p>Everything you need to work with documents, presentations, and images is right here. Choose a workspace to get started.</p>
						</div>
						<div className="workspace-home-spark" aria-hidden="true">✦</div>
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
