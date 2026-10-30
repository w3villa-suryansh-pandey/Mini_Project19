import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import WorkspaceHeader from '../../components/WorkspaceHeader.jsx'
import { getCachedCurrentUser, getUserProfile, getUserSubscription } from '../../services/api.js'

function ActionIcon({ type }) {
	const paths = {
		pdf: <><path d="M7 4h7l4 4v12H7z" /><path d="M9 14h6M9 17h6M9 10h2" /></>,
		compress: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
		image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M20 15l-4.2-4.2a1.6 1.6 0 0 0-2.2 0L9 16l-1.8-1.8a1.6 1.6 0 0 0-2.2 0L4 16" /></>,
	}
	return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>
}

function UserDashboard() {
	const uploadInputRef = useRef(null)
	const navigate = useNavigate()
	const cachedUser = useMemo(() => getCachedCurrentUser(), [])
	const [profile, setProfile] = useState({ name: cachedUser?.name || '', email: cachedUser?.email || '' })
	const [isLoading, setIsLoading] = useState(!cachedUser)
	const [error, setError] = useState('')
	const [subscription, setSubscription] = useState(null)
	const [lastPurchasedPlan, setLastPurchasedPlan] = useState(null)
	const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true)
	const [subscriptionError, setSubscriptionError] = useState('')
	const [dashboardFile, setDashboardFile] = useState(null)
	const [selectedFeature, setSelectedFeature] = useState('')
	const [uploadError, setUploadError] = useState('')
	const [isDraggingUpload, setIsDraggingUpload] = useState(false)

	const uploadFeatures = [
		{ label: 'PDF Editor', description: 'Edit, annotate, and organize documents.', href: '/editor', icon: 'pdf', accepts: (file) => /\.pdf$/i.test(file.name) || /\.docx$/i.test(file.name), hint: 'PDF or DOCX' },
		{ label: 'File Compressor', description: 'Shrink PDFs and images for easier sharing.', href: '/compressor', icon: 'compress', accepts: (file) => /\.pdf$/i.test(file.name) || /^image\//.test(file.type), hint: 'PDF or image' },
		{ label: 'Image Tools', description: 'Prepare, enhance, and transform images.', href: '/image-tools', icon: 'image', accepts: (file) => /^image\//.test(file.type), hint: 'Image' },
	]
	const activeUploadFeature = uploadFeatures.find((feature) => feature.href === selectedFeature)
	function selectDashboardFile(file) {
		if (!file) return
		setDashboardFile(file)
		setUploadError('')
		if (/\.pdf$/i.test(file.name)) setSelectedFeature('/editor')
		else if (/\.docx$/i.test(file.name)) setSelectedFeature('/editor')
		else if (/^image\//.test(file.type)) setSelectedFeature('/image-tools')
		else setSelectedFeature('')
	}

	function continueWithDashboardFile() {
		if (!dashboardFile || !activeUploadFeature) return
		if (!activeUploadFeature.accepts(dashboardFile)) {
			setUploadError(`Choose a ${activeUploadFeature.hint.toLowerCase()} file for ${activeUploadFeature.label}.`)
			return
		}
		navigate(activeUploadFeature.href, { state: { dashboardFile } })
	}

	useEffect(() => {
		if (cachedUser) return undefined
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
	}, [cachedUser])

	useEffect(() => {
		let isCurrent = true
		getUserSubscription({ refresh: true })
			.then(({ subscription: currentSubscription, lastPurchasedPlan: latestPlan }) => {
				if (isCurrent) {
					setSubscription(currentSubscription)
					setLastPurchasedPlan(latestPlan || null)
				}
			})
			.catch((exception) => {
				if (isCurrent) setSubscriptionError(exception.message || 'Subscription details could not be loaded.')
			})
			.finally(() => { if (isCurrent) setIsSubscriptionLoading(false) })
		return () => { isCurrent = false }
	}, [])

	const greeting = useMemo(() => {
		const currentHour = new Date().getHours()
		const timeOfDay = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening'
		const name = profile.name?.trim()?.split(/\s+/)?.[0] || 'there'
		return `${timeOfDay}! ${name === 'there' ? 'What would you like to create today?' : `${name}, what would you like to create today?`}`
	}, [profile.name])

	const featureLabels = {
		pdf_editor: 'PDF Editor',
		file_converter: 'File Converter',
		file_compressor: 'File Compressor',
		image_tools: 'Image Tools',
		presentation_studio: 'Presentation Studio',
	}
	const planFeatures = (subscription?.featureKeys || []).map((feature) => featureLabels[feature] || feature.replaceAll('_', ' '))
	const subscriptionExpiry = subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
	const lastPurchasedName = lastPurchasedPlan?.planName || (subscription?.active ? subscription.planName : '')
	const repeatPlanId = lastPurchasedPlan?.planId || (subscription?.active ? subscription.planId : '')
	const lastPurchasedAt = lastPurchasedPlan?.purchasedAt || (subscription?.active ? subscription.startsAt : null)
	const lastPurchasedDate = lastPurchasedAt ? new Date(lastPurchasedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

	return (
		<main className="dashboard-layout">
			<WorkspaceHeader active="/dashboard" />
			<section className="dashboard-content">
				<div className="dashboard-main">
					<div className="dashboard-page-heading">
						<p className="dashboard-eyebrow">YOUR WORKSPACE</p>
						<h1>{isLoading ? 'Loading your workspace…' : greeting}</h1>
					</div>
					<section className="dashboard-subscription-card" aria-labelledby="dashboard-subscription-title">
						<div className="dashboard-subscription-mark" aria-hidden="true">✦</div>
						<div className="dashboard-subscription-main">
							<p className="dashboard-eyebrow">YOUR PLAN</p>
							<h2 id="dashboard-subscription-title">{isSubscriptionLoading ? 'Checking your subscription…' : subscriptionError ? 'Subscription status unavailable' : subscription?.active ? (subscription.planName || 'Active plan') : 'No active subscription'}</h2>
							<p>{isSubscriptionLoading ? 'Loading your plan details.' : subscriptionError ? subscriptionError : subscription?.active ? `Your plan is active${subscriptionExpiry ? ` through ${subscriptionExpiry}` : ''}.` : 'Choose a plan to unlock PDF editing and downloads.'}</p>
							{subscription?.active && planFeatures.length > 0 && <div className="dashboard-subscription-features" aria-label="Included features">{planFeatures.map((feature) => <span key={feature}>{feature}</span>)}</div>}
						</div>
						<div className={`dashboard-subscription-status${subscription?.active ? ' is-active' : ''}`}>{isSubscriptionLoading ? 'CHECKING' : subscriptionError ? 'UNAVAILABLE' : subscription?.active ? 'ACTIVE' : 'INACTIVE'}</div>
						<Link className="dashboard-subscription-link" to={subscription?.active ? '/profile' : '/pricing'}>{subscription?.active ? 'View account' : 'Browse plans'} <span aria-hidden="true">→</span></Link>
					</section>
					<section className="dashboard-last-purchase-card" aria-labelledby="dashboard-last-purchase-title">
						<div className="dashboard-last-purchase-icon" aria-hidden="true">↻</div>
						<div className="dashboard-last-purchase-copy">
							<p className="dashboard-eyebrow">RECENT PURCHASE</p>
							<h2 id="dashboard-last-purchase-title">{isSubscriptionLoading ? 'Checking purchase history…' : lastPurchasedName || (subscriptionError ? 'Purchase history unavailable' : 'No plan purchased yet')}</h2>
							<p>{isSubscriptionLoading ? 'Loading your latest plan details.' : lastPurchasedDate ? `Purchased on ${lastPurchasedDate}` : lastPurchasedName ? 'Your most recently purchased plan.' : subscriptionError ? subscriptionError : 'Your purchased plans will appear here.'}</p>
						</div>
						{repeatPlanId
							? <Link className="dashboard-repeat-plan-button" to={`/payment?plan=${encodeURIComponent(repeatPlanId)}`}>Repeat plan <span aria-hidden="true">↗</span></Link>
							: <span className="dashboard-last-purchase-badge">LAST PLAN</span>}
					</section>

					<section className="dashboard-quick-start" aria-labelledby="dashboard-quick-start-title">
						<div className="dashboard-quick-start-heading">
							<div className="dashboard-quick-start-icon" aria-hidden="true">↑</div>
							<div><p className="dashboard-eyebrow">QUICK START</p><h2 id="dashboard-quick-start-title">Choose a file and get started</h2><p>Upload a file, choose a tool, and continue straight to your workspace.</p></div>
						</div>
						<div
							className={`dashboard-quick-start-dropzone${isDraggingUpload ? ' is-dragging' : ''}${dashboardFile ? ' has-file' : ''}`}
							onDragOver={(event) => { event.preventDefault(); setIsDraggingUpload(true) }}
							onDragLeave={() => setIsDraggingUpload(false)}
							onDrop={(event) => { event.preventDefault(); setIsDraggingUpload(false); selectDashboardFile(event.dataTransfer.files?.[0]) }}
						>
							<input ref={uploadInputRef} type="file" accept=".pdf,.docx,image/*" onChange={(event) => { selectDashboardFile(event.target.files?.[0]); event.target.value = '' }} aria-label="Choose a PDF, DOCX, or image file" />
							<span className="dashboard-quick-start-file-icon" aria-hidden="true">▤</span>
							<div className="dashboard-quick-start-file-copy"><strong>{dashboardFile ? dashboardFile.name : 'Drop your file here'}</strong><span>{dashboardFile ? `${(dashboardFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to open` : 'PDF, DOCX, or image · Choose a file from your device'}</span></div>
							<button type="button" className="dashboard-quick-start-browse" onClick={() => uploadInputRef.current?.click()}>{dashboardFile ? 'Change file' : 'Choose file'}</button>
						</div>
						<div className="dashboard-quick-start-feature-picker" role="group" aria-labelledby="dashboard-quick-start-feature-title">
							<div className="dashboard-quick-start-feature-heading"><span id="dashboard-quick-start-feature-title">Choose a feature</span><small>{dashboardFile ? 'Tools supported by your selected file' : 'Select a file to see compatible tools'}</small></div>
							<div className="dashboard-quick-start-feature-list">
								{uploadFeatures.map((feature) => {
									const isCompatible = !dashboardFile || feature.accepts(dashboardFile)
									const isSelected = selectedFeature === feature.href
									return (
										<button type="button" className={`dashboard-quick-start-feature${isSelected ? ' is-selected' : ''}`} key={feature.href} aria-pressed={isSelected} disabled={!isCompatible} onClick={() => { setSelectedFeature(feature.href); setUploadError('') }}>
											<span className="dashboard-quick-start-feature-icon"><ActionIcon type={feature.icon} /></span>
											<span className="dashboard-quick-start-feature-copy"><strong>{feature.label}</strong><small>{feature.description}</small></span>
											<span className="dashboard-quick-start-feature-check" aria-hidden="true">{isSelected ? '✓' : '→'}</span>
										</button>
									)
								})}
							</div>
						</div>
						<div className="dashboard-quick-start-controls">
							<span>{activeUploadFeature ? `Selected: ${activeUploadFeature.label}` : 'Choose one of the tools above'}</span>
							<button type="button" className="dashboard-quick-start-go" onClick={continueWithDashboardFile} disabled={!dashboardFile || !activeUploadFeature}>Open feature <span aria-hidden="true">→</span></button>
						</div>
						{uploadError && <p className="dashboard-quick-start-error" role="alert">{uploadError}</p>}
					</section>

						{error && (
							<p className="dashboard-profile-error" role="alert">
								Your account details could not be loaded: {error} You can still use the workspace tools.
							</p>
						)}

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
									<Link to="/editor">Open a PDF <span aria-hidden="true">→</span></Link>
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
								<Link to="/profile" aria-label="Open account settings">→</Link>
								</div>
							</aside>
					</div>
				</div>
			</section>
		</main>
	)
}

export default UserDashboard
