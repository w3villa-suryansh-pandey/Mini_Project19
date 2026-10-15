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
		<main className="admin-layout">
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
								<div className={`admin-stat-mark ${item.tone}`} aria-hidden="true" />
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
