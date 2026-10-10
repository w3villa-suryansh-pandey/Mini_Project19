import { useEffect, useMemo, useState } from 'react'
import AccountBadge from '../../components/AccountBadge.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { getUserProfile } from '../../services/api.js'

const actions = [
	{
		label: 'Edit a PDF',
		description: 'Open and annotate a PDF in your browser.',
		href: '/editor',
		accent: 'indigo',
		icon: 'pdf',
		keywords: 'pdf edit annotate sign pages',
	},
	{
		label: 'Write a document',
		description: 'Draft, format, and export a document.',
		href: '/writing-pad',
		accent: 'pink',
		icon: 'write',
		keywords: 'write document notes draft text',
	},
	{
		label: 'Convert files',
		description: 'Convert images, PDFs, or Word documents.',
		href: '/converter',
		accent: 'cyan',
		icon: 'convert',
		keywords: 'convert images pdf docx word format',
	},
	{
		label: 'Compress files',
		description: 'Reduce image or PDF file sizes.',
		href: '/compressor',
		accent: 'orange',
		icon: 'compress',
		keywords: 'compress reduce image pdf size',
	},
	{
		label: 'Image tools',
		description: 'Create a passport photo or remove a background in seconds.',
		href: '/image-tools',
		accent: 'blue',
		icon: 'image',
		keywords: 'image passport photo background remover editor',
	},
]

function ActionIcon({ type }) {
	const icons = {
		pdf: <><path d="M7 4h7l4 4v12H7z" /><path d="M9 14h6M9 17h6M9 10h2" /></>,
		write: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /><path d="m17 16 3 3" /></>,
		convert: <><path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" /></>,
		compress: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
		image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M20 15l-4.2-4.2a1.6 1.6 0 0 0-2.2 0L9 16l-1.8-1.8a1.6 1.6 0 0 0-2.2 0L4 16" /></>,
	}

	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			{icons[type]}
		</svg>
	)
}

function UserDashboard() {
	const [profile, setProfile] = useState({ name: '', email: '' })
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [searchTerm, setSearchTerm] = useState('')

	useEffect(() => {
		let isCurrent = true
		getUserProfile()
			.then(({ profile: savedProfile }) => {
				if (isCurrent) {
					setProfile({
						name: savedProfile.name || 'S19 user',
						email: savedProfile.email || '',
					})
				}
			})
			.catch((exception) => {
				if (isCurrent) setError(exception.message)
			})
			.finally(() => { if (isCurrent) setIsLoading(false) })
		return () => { isCurrent = false }
	}, [])

	const greeting = useMemo(() => {
		const currentHour = new Date().getHours()
		const timeOfDay = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening'
		const name = profile.name?.trim()?.split(/\s+/)?.[0] || 'there'
		return `${timeOfDay}! ${name === 'there' ? 'What would you like to create today?' : `${name}, what would you like to create today?`}`
	}, [profile.name])

	const filteredActions = useMemo(() => {
		const query = searchTerm.trim().toLowerCase()
		if (!query) return actions
		return actions.filter((action) => (
			`${action.label} ${action.description} ${action.keywords}`.toLowerCase().includes(query)
		))
	}, [searchTerm])

	return (
		<main className="dashboard-layout">
			<Sidebar active="/dashboard" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-header-left">
						<div className="dashboard-breadcrumb">Workspace <span>/</span> Overview</div>
					</div>
					<div className="dashboard-header-actions">
						<label className="dashboard-search">
							<span aria-hidden="true">⌕</span>
							<input
								type="search"
								placeholder="Search tools…"
								aria-label="Search tools"
								value={searchTerm}
								onChange={(event) => setSearchTerm(event.target.value)}
							/>
						</label>
						<AccountBadge user={profile} />
					</div>
				</header>

				<div className="dashboard-main">
					<div className="dashboard-welcome">
						<div>
							<p className="dashboard-eyebrow">YOUR WORKSPACE</p>
							<h1>{isLoading ? 'Loading your workspace…' : greeting}</h1>
								<p>Choose a tool to work with your documents, create something new, or prepare a file to share.</p>
						</div>
						<div className="dashboard-summary-card">
								<span>Tools in your workspace</span>
								<strong>{actions.length}</strong>
								<small>PDF, writing, conversion, and compression</small>
						</div>
					</div>

						{error && (
							<p className="dashboard-profile-error" role="alert">
								Your account details could not be loaded: {error} You can still use the workspace tools.
							</p>
						)}

						<section className="dashboard-actions-panel">
							<div className="dashboard-section-heading">
								<h2>Workspace tools</h2>
								<span className="dashboard-tool-count">{filteredActions.length} {filteredActions.length === 1 ? 'tool' : 'tools'}</span>
							</div>
							<div className="dashboard-action-grid">
								{filteredActions.length > 0 ? filteredActions.map((action) => (
									<a href={action.href} className={`dashboard-action-card accent-${action.accent}`} key={action.label}>
										<span className="dashboard-action-icon"><ActionIcon type={action.icon} /></span>
										<span className="dashboard-action-copy">
											<strong>{action.label}</strong>
											<small>{action.description}</small>
										</span>
										<span className="dashboard-action-arrow" aria-hidden="true">↗</span>
									</a>
								)) : (
									<div className="dashboard-no-results" role="status">
										<p>No tools match “{searchTerm.trim()}”.</p>
										<button type="button" onClick={() => setSearchTerm('')}>Clear search</button>
								</div>
								)}
							</div>
						</section>

						<div className="dashboard-panels">
							<section className="dashboard-panel dashboard-files-panel">
								<div className="dashboard-section-heading">
									<h2>Your files</h2>
									<span className="dashboard-local-badge"><span aria-hidden="true" />Private workspace</span>
								</div>
								<div className="dashboard-files-empty">
									<div className="dashboard-empty-icon" aria-hidden="true">✦</div>
									<div>
										<h3>No saved files here yet</h3>
										<p>Files are opened and processed in the tools above; this workspace does not keep a cloud file library.</p>
									</div>
									<a href="/editor">Open a PDF <span aria-hidden="true">→</span></a>
								</div>
							</section>

							<aside className="dashboard-panel dashboard-insights">
								<div className="dashboard-section-heading">
									<h2>How your tools work</h2>
								</div>
								<div className="dashboard-metric-card primary">
									<span>Work privately</span>
									<strong>Files stay on your device</strong>
									<small>Conversion, compression, and writing tools process your work in this browser.</small>
								</div>
								<div className="dashboard-profile-shortcut">
									<div>
										<strong>Account settings</strong>
										<span>Manage your profile and sign-in options.</span>
									</div>
									<a href="/profile" aria-label="Open account settings">→</a>
								</div>
							</aside>
					</div>
				</div>
			</section>
		</main>
	)
}

export default UserDashboard
