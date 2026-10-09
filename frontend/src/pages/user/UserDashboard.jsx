import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import { getUserProfile } from '../../services/api.js'

const actions = [
	{ label: 'New document', href: '/editor', accent: 'indigo', icon: 'document' },
	{ label: 'Open PDF editor', href: '/editor', accent: 'violet', icon: 'pdf' },
	{ label: 'Document editor', href: '/editor', accent: 'blue', icon: 'document' },
	{ label: 'Write a note', href: '/writing-pad', accent: 'pink', icon: 'write' },
	{ label: 'Convert a file', href: '/converter', accent: 'cyan', icon: 'convert' },
	{ label: 'Compress a file', href: '/compressor', accent: 'orange', icon: 'compress' },
	{ label: 'Upload a document', href: '/profile', accent: 'emerald', icon: 'upload' },
]

function ActionIcon({ type }) {
	const icons = {
		document: <><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v4h4M9 12h6M9 16h5" /></>,
		pdf: <><path d="M7 4h7l4 4v12H7z" /><path d="M9 14h6M9 17h6M9 10h2" /></>,
		write: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /><path d="m17 16 3 3" /></>,
		convert: <><path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" /></>,
		compress: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
		upload: <><path d="M12 16V5m0 0-4 4m4-4 4 4M5 18v1h14v-1" /></>,
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

	const initials = (profile.name || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S'

	return (
		<main className="dashboard-layout">
			<Sidebar active="/dashboard" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-header-left">
						<div className="dashboard-breadcrumb">Workspace <span>/</span> Overview</div>
					</div>
					<div className="dashboard-header-actions">
						<label className="dashboard-search" aria-label="Search workspace">
							<span aria-hidden="true">⌕</span>
							<input type="search" placeholder="Search tools…" aria-label="Search workspaces" />
						</label>
						<a className="dashboard-account-link" href="/profile">
							<span className="dashboard-account-avatar" aria-hidden="true">{initials}</span>
							<span>
								<strong>{profile.name || 'My account'}</strong>
								<small>{profile.email || 'Workspace'}</small>
							</span>
						</a>
					</div>
				</header>

				<div className="dashboard-main">
					<div className="dashboard-welcome">
						<div>
							<p className="dashboard-eyebrow">YOUR WORKSPACE</p>
							<h1>{isLoading ? 'Loading your workspace…' : greeting}</h1>
							<p>Turn files into polished deliverables, notes, and exports without breaking your focus.</p>
						</div>
						<div className="dashboard-summary-card">
							<span>Workspace status</span>
							<strong>Ready</strong>
							<small>All tools available</small>
						</div>
					</div>

					<section className="dashboard-actions-panel">
						<div className="dashboard-section-heading">
							<h2>Quick actions</h2>
							<a href="/dashboard">View all</a>
						</div>
						<div className="dashboard-action-grid">
							{actions.map((action) => (
								<a href={action.href} className={`dashboard-action-card accent-${action.accent}`} key={action.label}>
									<span className="dashboard-action-icon"><ActionIcon type={action.icon} /></span>
									<span>{action.label}</span>
								</a>
							))}
						</div>
					</section>

					<div className="dashboard-panels">
						<section className="dashboard-panel dashboard-recent">
							<div className="dashboard-section-heading">
								<h2>Recent files</h2>
								<a href="/profile">Open workspace</a>
							</div>
							{error ? (
								<div className="dashboard-empty state-error">
									<h3>We could not load recent files</h3>
									<p>{error}</p>
								</div>
							) : isLoading ? (
								<div className="dashboard-skeleton-group" aria-label="Loading recent files">
									<span className="dashboard-skeleton" />
									<span className="dashboard-skeleton short" />
									<span className="dashboard-skeleton" />
								</div>
							) : (
								<div className="dashboard-empty">
									<div className="dashboard-empty-icon" aria-hidden="true">✦</div>
									<h3>No recent files yet</h3>
									<p>Upload or create a document to see it appear here.</p>
									<a href="/editor">Create a file</a>
								</div>
							)}
						</section>

						<aside className="dashboard-panel dashboard-insights">
							<div className="dashboard-section-heading">
								<h2>Productivity pulse</h2>
							</div>
							<div className="dashboard-metric-card primary">
								<span>Current focus</span>
								<strong>Document review</strong>
								<small>Keep your workflow clear and consistent.</small>
							</div>
							<div className="dashboard-metric-card">
								<span>Next best action</span>
								<strong>Convert or compress a file</strong>
								<small>Use the right tool before you share.</small>
							</div>
						</aside>
					</div>
				</div>
			</section>
		</main>
	)
}

export default UserDashboard

