import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import AccountBadge from '../../components/AccountBadge.jsx'
import {
	confirmRazorpayPayment,
	createRazorpayOrder,
	getPricingPlans,
	getUserSubscription,
} from '../../services/api.js'

let razorpayScriptPromise

function loadRazorpay() {
	if (window.Razorpay) return Promise.resolve()
	if (!razorpayScriptPromise) {
		razorpayScriptPromise = new Promise((resolve, reject) => {
			const script = document.createElement('script')
			script.src = 'https://checkout.razorpay.com/v1/checkout.js'
			script.onload = () => {
				if (window.Razorpay) resolve()
				else {
					script.remove()
					reject(new Error('Razorpay Checkout could not be loaded.'))
				}
			}
			script.onerror = () => {
				script.remove()
				reject(new Error('Razorpay Checkout could not be loaded.'))
			}
			document.body.appendChild(script)
		}).catch((error) => {
			razorpayScriptPromise = null
			throw error
		})
	}
	return razorpayScriptPromise
}

function Payment() {
	const searchParams = new URLSearchParams(window.location.search)
	const selectedPlanId = searchParams.get('plan')
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
		getUserSubscription()
			.then(({ subscription: currentSubscription }) => {
				if (isCurrent) setSubscription(currentSubscription)
			})
			.catch((error) => {
				if (isCurrent) setNotice(error.message)
			})
			.finally(() => {
				if (isCurrent) setIsLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	async function startCheckout() {
		if (!selectedPlan) return
		setIsStartingCheckout(true)
		setNotice('')
		try {
			const checkout = await createRazorpayOrder(selectedPlan.id)
			await loadRazorpay()
			const razorpay = new window.Razorpay({
				key: checkout.keyId,
				order_id: checkout.order.id,
				amount: checkout.order.amount,
				currency: checkout.order.currency,
				name: 'S19',
				description: checkout.description,
				prefill: { email: checkout.email },
				handler: async (paymentDetails) => {
					try {
						const { subscription: currentSubscription } = await confirmRazorpayPayment(paymentDetails)
						setSubscription(currentSubscription)
						setNotice(currentSubscription.active
							? 'Payment confirmed. Your PDF editing pass is active.'
							: 'Payment is still processing. Refresh this page shortly to check again.')
					} catch (error) {
						setNotice(error.message)
					} finally {
						setIsStartingCheckout(false)
					}
				},
				modal: {
					ondismiss: () => setIsStartingCheckout(false),
				},
			})
			razorpay.on('payment.failed', (event) => {
				setNotice(event.error?.description || 'Razorpay could not complete the payment.')
				setIsStartingCheckout(false)
			})
			razorpay.open()
		} catch (error) {
			setNotice(error.message)
			setIsStartingCheckout(false)
		}
	}

	const formattedExpiry = subscription?.expiresAt
		? new Date(subscription.expiresAt).toLocaleString()
		: ''

	return (
		<main className="dashboard-layout">
			<Sidebar active="payments" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> Payments</div>
					<AccountBadge />
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
								: <p>{isPlansLoading ? 'Loading available plans…' : 'Select a plan to continue to secure Razorpay checkout.'}</p>}
						</div>
						{selectedPlan
							? <button className="payment-checkout-button" type="button" onClick={startCheckout} disabled={isLoading || isStartingCheckout}>
								{isStartingCheckout ? 'Opening checkout…' : `Pay ${selectedPrice}`}
							</button>
							: <a href="/pricing">View passes <span aria-hidden="true">→</span></a>}
					</section>
					<p className="subscription-expiry-note">Access is activated only after Razorpay verifies successful payment. {subscription?.active ? `Your current pass is valid until ${formattedExpiry}.` : ''}</p>
				</div>
			</section>
		</main>
	)
}

export default Payment
