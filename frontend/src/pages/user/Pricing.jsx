import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import { getPricingPlans } from '../../services/api.js'

function Pricing() {
	const [plans, setPlans] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [notice, setNotice] = useState('')

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
				if (isCurrent) setIsLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	return (
		<main className="dashboard-layout">
			<Sidebar active="plans" />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> Pricing plans</div>
					<a className="dashboard-account-link" href="/profile">
						<span className="dashboard-account-avatar" aria-hidden="true">W</span>
						<span>My account</span>
					</a>
				</header>
				<div className="dashboard-main">
					<div className="dashboard-welcome pricing-welcome">
						<p className="dashboard-eyebrow">PDF WORKSPACE</p>
						<h1>Choose your editor access</h1>
						<p>Choose a time-limited pass to use the PDF editor and download edited files.</p>
					</div>
					<div className="pricing-billing-note">
						<span className="pricing-note-dot" aria-hidden="true" />
						<span>One-time payment · Prices in INR · Access starts after payment</span>
					</div>
					<section className="pdf-pricing-grid" aria-label="PDF editing subscription plans">
						{plans.map((plan, index) => (
							<article className="pdf-pricing-card" key={plan.id}>
								<div className="pdf-plan-topline">
									<span className="pdf-plan-index">0{index + 1}</span>
								</div>
								<h2>{plan.name}</h2>
								<p className="pdf-plan-description">PDF editing access</p>
								<div className="pdf-plan-price">
									<strong>₹{Number(plan.priceRupees).toLocaleString('en-IN')}</strong>
									<span>/ {plan.durationValue} {plan.durationUnit}{plan.durationValue === 1 ? '' : 's'}</span>
								</div>
								<p className="pdf-plan-billing">One-time payment</p>
								<a className="pdf-plan-action" href={`/payment?plan=${plan.id}`}>
									Select plan <span aria-hidden="true">→</span>
								</a>
								<div className="pdf-plan-divider" />
								<p className="pdf-plan-includes">INCLUDED TOOLS</p>
								<ul className="pdf-plan-features">
									{plan.features.map((feature) => <li key={feature}>{feature}</li>)}
								</ul>
							</article>
						))}
					</section>
					{isLoading && <p className="pricing-checkout-note">Loading available plans…</p>}
					{notice && <p className="pricing-checkout-note" role="alert">{notice}</p>}
					{!isLoading && !notice && plans.length === 0 && <p className="pricing-checkout-note">No plans are currently available.</p>}
					{plans.length > 0 && <p className="pricing-checkout-note">Your pass activates only after Stripe confirms payment.</p>}
				</div>
			</section>
		</main>
	)
}

export default Pricing
