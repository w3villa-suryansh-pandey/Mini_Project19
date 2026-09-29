import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import { confirmCheckoutSession, createCheckoutSession, getPricingPlans, getUserSubscription } from '../../services/api.js'

function Payment() {
	const searchParams = new URLSearchParams(window.location.search)
	const selectedPlanId = searchParams.get('plan')
	const sessionId = searchParams.get('payment') === 'success' ? searchParams.get('session_id') : ''
	const [plans, setPlans] = useState([])
	const [subscription, setSubscription] = useState(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isPlansLoading, setIsPlansLoading] = useState(true)
	const [isStartingCheckout, setIsStartingCheckout] = useState(false)
	const [notice, setNotice] = useState('')
	const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)
	const selectedPrice = selectedPlan ? `₹${Number(selectedPlan.priceRupees).toLocaleString('en-IN')}` : ''
	const selectedDuration = selectedPlan
		? `${selectedPlan.durationValue} ${selectedPlan.durationUnit}${selectedPlan.durationValue === 1 ? '' : 's'}`
		: ''

	useEffect(() => {
		let isCurrent = true
		getPricingPlans()
			.then(({ plans: availablePlans }) => {
				if (isCurrent) setPlans(availablePlans)
			})
			.catch((error) => {
				if (isCurrent) setNotice(error.message)
			})
			.finally(() => {
				if (isCurrent) setIsPlansLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	useEffect(() => {
		let isCurrent = true
		const fetchSubscription = sessionId
			? confirmCheckoutSession(sessionId)
			: getUserSubscription()

		fetchSubscription
			.then(({ subscription: currentSubscription }) => {
				if (isCurrent) {
					setSubscription(currentSubscription)
					if (sessionId && currentSubscription.active) setNotice('Payment confirmed. Your PDF editing pass is active.')
					else if (sessionId) setNotice('Payment is still processing. Refresh this page shortly to check again.')
				}
			})
			.catch((error) => {
				if (isCurrent) setNotice(error.message)
			})
			.finally(() => {
				if (isCurrent) setIsLoading(false)
			})

		return () => { isCurrent = false }
	}, [sessionId])

	async function startCheckout() {
		if (!selectedPlan) return
		setIsStartingCheckout(true)
		setNotice('')
		try {
			const { checkoutUrl } = await createCheckoutSession(selectedPlan.id)
			window.location.assign(checkoutUrl)
		} catch (error) {
			setNotice(error.message)
			setIsStartingCheckout(false)
		}
	}

	const paymentCancelled = searchParams.get('payment') === 'cancelled'
	const formattedExpiry = subscription?.expiresAt
		? new Date(subscription.expiresAt).toLocaleString()
		: ''

	return (
		<main className="dashboard-layout">
			<Sidebar active="payments" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> Payments</div>
					<a className="dashboard-account-link" href="/profile">
						<span className="dashboard-account-avatar" aria-hidden="true">W</span>
						<span>My account</span>
					</a>
				</header>
				<div className="dashboard-main">
					<div className="dashboard-welcome">
						<p className="dashboard-eyebrow">WORKSPACE</p>
						<h1>Subscription</h1>
						<p>Purchase a pass to unlock edited PDF downloads.</p>
					</div>
					{notice && <p className="payment-notice" role="status">{notice}</p>}
					{subscription?.active && (
						<section className="workspace-notice subscription-active-notice" aria-labelledby="subscription-active-title">
							<span className="subscription-active-mark" aria-hidden="true">✓</span>
							<div>
								<h2 id="subscription-active-title">PDF editing pass active</h2>
								<p>{subscription.planName || subscription.planId} · Access ends {formattedExpiry}</p>
							</div>
						</section>
					)}
					<section className="workspace-notice payment-plan-notice" aria-labelledby="payment-notice-title">
						<span className="workspace-notice-mark" aria-hidden="true">₹</span>
						<div>
							<h2 id="payment-notice-title">{selectedPlan ? 'Review your pass' : 'Choose a pass'}</h2>
							{selectedPlan
								? <p className="payment-selected-plan">{selectedPlan.name} · {selectedPrice} · {selectedDuration}</p>
								: <p>{isPlansLoading ? 'Loading available plans…' : 'Select a plan to continue to secure Stripe checkout.'}</p>}
							{paymentCancelled && <p>Checkout was cancelled. No payment was taken.</p>}
						</div>
						{selectedPlan
							? <button className="payment-checkout-button" type="button" onClick={startCheckout} disabled={isLoading || isStartingCheckout}>
								{isStartingCheckout ? 'Opening checkout…' : `Pay ${selectedPrice}`}
							</button>
							: <a href="/pricing">View passes <span aria-hidden="true">→</span></a>}
					</section>
					<p className="subscription-expiry-note">Access is activated only after Stripe verifies successful payment. {subscription?.active ? `Your current pass is valid until ${formattedExpiry}.` : ''}</p>
				</div>
			</section>
		</main>
	)
}

export default Payment
