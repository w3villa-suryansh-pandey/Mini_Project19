import { useEffect, useState } from 'react'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import {
	createSubscriptionExpiryJob,
	deleteSubscriptionExpiryJob,
	getSubscriptionExpiryJob,
	runSubscriptionExpiryJob,
	setSubscriptionExpiryJobEnabled,
} from '../../services/api.js'

function Cronjobs() {
	const [job, setJob] = useState(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isWorking, setIsWorking] = useState(false)
	const [notice, setNotice] = useState('')
	const [error, setError] = useState('')

	useEffect(() => {
		let isCurrent = true
		getSubscriptionExpiryJob()
			.then(({ job: expiryJob }) => {
				if (isCurrent) setJob(expiryJob)
			})
			.catch((loadError) => {
				if (isCurrent) setError(loadError.message)
			})
			.finally(() => {
				if (isCurrent) setIsLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	async function toggleJob() {
		if (!job) return
		setIsWorking(true)
		setError('')
		try {
			const { job: updatedJob } = await setSubscriptionExpiryJobEnabled(job.status !== 'Enabled')
			setJob(updatedJob)
			setNotice(`Subscription expiry job ${updatedJob.status.toLowerCase()}.`)
		} catch (actionError) {
			setError(actionError.message)
		} finally {
			setIsWorking(false)
		}
	}

	async function runJob() {
		setIsWorking(true)
		setError('')
		try {
			const result = await runSubscriptionExpiryJob()
			setJob(result.job)
			setNotice(`Expiry check finished. ${result.expiredCount} subscription${result.expiredCount === 1 ? '' : 's'} expired.`)
		} catch (actionError) {
			setError(actionError.message)
		} finally {
			setIsWorking(false)
		}
	}

	async function createJob() {
		setIsWorking(true)
		setError('')
		try {
			const { job: createdJob } = await createSubscriptionExpiryJob()
			setJob(createdJob)
			setNotice('Subscription expiry job created and enabled.')
		} catch (actionError) {
			setError(actionError.message)
		} finally {
			setIsWorking(false)
		}
	}

	async function deleteJob() {
		if (!window.confirm('Delete the subscription expiry job? Expired passes will still be blocked, but automatic cleanup will stop.')) return
		setIsWorking(true)
		setError('')
		try {
			await deleteSubscriptionExpiryJob()
			setJob(null)
			setNotice('Subscription expiry job deleted.')
		} catch (actionError) {
			setError(actionError.message)
		} finally {
			setIsWorking(false)
		}
	}

	const lastRun = job?.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : 'Never'

	return (
		<main className="admin-layout">
			<AdminSidebar active="jobs" />
			<section className="admin-main-panel">
				<header className="admin-topbar"><div className="admin-breadcrumb">Administration <span>/</span> Cron jobs</div><div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<span className="admin-topbar-avatar">AD</span></div></header>
				<div className="admin-content">
					<div className="admin-page-heading compact">
						<div><p className="admin-eyebrow">AUTOMATION</p><h1>Cron jobs</h1><p>Manage subscription expiry and its server-side schedule.</p></div>
						{!isLoading && !job && !error && <button className="admin-primary-button" type="button" onClick={createJob} disabled={isWorking}>＋ Create expiry job</button>}
					</div>
					{notice && <p className="admin-inline-notice" role="status">{notice}</p>}
					{error && <p className="admin-inline-notice" role="alert">{error}</p>}
					<section className="admin-panel jobs-panel">
						<div className="users-panel-heading"><div><h2>Scheduled jobs</h2><p>{job?.status === 'Enabled' ? '1 enabled schedule' : 'No enabled schedules'}</p></div><span className="admin-demo-tag">SERVER JOB</span></div>
						<div className="cron-job-list">
							{isLoading && <p className="admin-empty-state">Loading scheduled job…</p>}
							{!isLoading && !job && !error && <p className="admin-empty-state">The subscription expiry job has not been created.</p>}
							{job && (
								<article className="cron-job-row" key={job.id}>
									<span className="cron-job-symbol" aria-hidden="true">◷</span>
									<div className="cron-job-info"><h3>{job.name}</h3><p>{job.description}</p></div>
									<div className="cron-job-time"><span>Schedule</span><strong>{job.schedule}</strong></div>
									<div className="cron-job-time last-run"><span>Last run · {job.lastExpiredCount} expired</span><strong>{lastRun}</strong></div>
									<span className={`cron-status ${job.status.toLowerCase()}`}><span />{job.status}</span>
									<div className="cron-actions">
										<button type="button" onClick={runJob} disabled={isWorking}>Run now</button>
										<button className="cron-toggle" type="button" onClick={toggleJob} disabled={isWorking}>{job.status === 'Enabled' ? 'Pause' : 'Enable'}</button>
										<button className="cron-delete" type="button" onClick={deleteJob} disabled={isWorking}>Delete</button>
									</div>
								</article>
							)}
						</div>
						<p className="plan-data-note">Expired subscriptions remain in the database for purchase history; the expiry timestamp immediately blocks access.</p>
					</section>
				</div>
			</section>
		</main>
	)
}

export default Cronjobs
