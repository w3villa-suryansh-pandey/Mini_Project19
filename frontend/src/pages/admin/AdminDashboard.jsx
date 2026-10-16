import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountBadge from '../../components/AccountBadge.jsx'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { getAdminActiveSubscriberCount, getAdminPlans, getAdminUsers, getSubscriptionExpiryJob } from '../../services/api.js'

const activity = []

function AdminDashboard() {
	const [summary, setSummary] = useState(null)
	const [summaryError, setSummaryError] = useState('')

	useEffect(() => {
		let isCurrent = true
		Promise.all([getAdminUsers(), getAdminPlans(), getSubscriptionExpiryJob(), getAdminActiveSubscriberCount()])
			.then(([{ users }, { plans }, { job }, { count: activeSubscribers }]) => {
				if (!isCurrent) return
				setSummary([
					{ label: 'Total users', value: users.length, change: 'Registered accounts', tone: 'green' },
					{ label: 'Active plans', value: plans.filter((plan) => plan.isActive).length, change: 'Available to users', tone: 'blue' },
					{ label: 'Active subscribers', value: activeSubscribers, change: 'Paid access now', tone: 'green' },
					{ label: 'Cron jobs', value: job ? 1 : 0, change: job?.status || 'Not created', tone: 'amber' },
				])
			})
			.catch((error) => {
				if (isCurrent) setSummaryError(error.message)
			})

		return () => { isCurrent = false }
	}, [])

	return (
		<main className="admin-layout admin-overview-layout">
			<AdminSidebar active="overview" />
			<section className="admin-main-panel">
				<header className="admin-topbar">
					<div className="admin-breadcrumb">Administration <span>/</span> Overview</div>
					<div className="admin-topbar-user">
						<span className="admin-status-dot" /> System operational
						<AccountBadge variant="admin" />
					</div>
				</header>
				<div className="admin-content">
					<div className="admin-page-heading">
						<div>
							<p className="admin-eyebrow">ADMIN CONSOLE</p>
							<h1>Workspace overview</h1>
							<p>Here’s what’s happening across your workspace.</p>
						</div>
						<Link className="admin-primary-link" to="/admin/users">View users <span aria-hidden="true">→</span></Link>
					</div>

					<section className="admin-stat-grid" aria-label="Workspace summary">
						{(summary || [
							{ label: 'Total users', value: '—', change: 'Loading', tone: 'green' },
							{ label: 'Active plans', value: '—', change: 'Loading', tone: 'blue' },
							{ label: 'Active subscribers', value: '—', change: 'Loading', tone: 'green' },
							{ label: 'Cron jobs', value: '—', change: 'Loading', tone: 'amber' },
						]).map((item) => (
							<article className="admin-stat" key={item.label}>
								<div className={`admin-stat-mark ${item.tone}`} aria-hidden="true">
									<svg viewBox="0 0 24 24">
										{item.label === 'Total users' && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.5-3.2 2.3-4.8 5.5-4.8s5 1.6 5.5 4.8M16 5.5a3 3 0 0 1 0 5.8M17 15.3c2.2.5 3.4 2 3.8 4.7" /></>}
										{item.label === 'Active plans' && <><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5v5h4M8 13h8M8 17h6" /></>}
										{item.label === 'Active subscribers' && <><path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.9L12 3.5Z" /></>}
										{item.label === 'Cron jobs' && <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>}
									</svg>
								</div>
								<p>{item.label}</p>
								<div className="admin-stat-value-row">
									<strong>{item.value}</strong>
									<span>{item.change}</span>
								</div>
							</article>
						))}
					</section>
					{summaryError && <p className="admin-inline-notice" role="alert">{summaryError}</p>}

					<div className="admin-dashboard-grid">
						<section className="admin-panel activity-panel">
							<div className="admin-panel-heading">
								<div><h2>Recent activity</h2><p>Latest changes across your workspace</p></div>
								<Link to="/admin/users">All users <span aria-hidden="true">→</span></Link>
							</div>
							<div className="admin-activity-list">
								{activity.length === 0 && <p className="admin-empty-state">No activity records are available yet.</p>}
								{activity.map((item) => (
									<div className="admin-activity-row" key={item.name}>
										<span className={`admin-user-avatar ${item.color}`}>{item.initials}</span>
										<div className="admin-activity-copy"><strong>{item.name}</strong><span>{item.detail}</span></div>
										<time>{item.time}</time>
									</div>
								))}
							</div>
							<p className="admin-demo-note">Account activity tracking is not enabled.</p>
						</section>

						<section className="admin-panel admin-quick-actions">
							<div className="admin-panel-heading"><div><h2>Quick access</h2><p>Manage your workspace</p></div></div>
							<Link className="admin-action-link" to="/admin/plans"><span className="admin-action-icon">＋</span><span><strong>Create a plan</strong><small>Add or update subscription options</small></span><span className="admin-chevron">→</span></Link>
							<Link className="admin-action-link" to="/admin/cronjobs"><span className="admin-action-icon clock">◷</span><span><strong>Review cron jobs</strong><small>Check scheduled background tasks</small></span><span className="admin-chevron">→</span></Link>
							<Link className="admin-action-link" to="/admin/users"><span className="admin-action-icon users">◎</span><span><strong>Manage users</strong><small>Search and filter accounts</small></span><span className="admin-chevron">→</span></Link>
						</section>
					</div>
					<p className="admin-data-note">Counts refresh when this page loads and reflect current database records.</p>
				</div>
			</section>
		</main>
	)
}

export default AdminDashboard
