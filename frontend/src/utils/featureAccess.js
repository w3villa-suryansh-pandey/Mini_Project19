import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUserSubscription } from '../services/api.js'

export function useFeatureAccess(featureKey) {
	const [access, setAccess] = useState({ status: 'checking', active: false, allowed: false })

	useEffect(() => {
		let isCurrent = true
		getUserSubscription({ refresh: true })
			.then(({ subscription }) => {
				if (!isCurrent) return
				const active = Boolean(subscription?.active)
				const allowed = active && Array.isArray(subscription?.featureKeys) && subscription.featureKeys.includes(featureKey)
				setAccess({ status: 'ready', active, allowed })
			})
			.catch((error) => {
				if (isCurrent) setAccess({ status: 'error', active: false, allowed: false, error: error.message })
			})
		return () => { isCurrent = false }
	}, [featureKey])

	return access
}

export function FeatureAccessNotice({ access, featureName }) {
	if (access.status === 'checking') return <p className="feature-access-notice" role="status">Checking your plan access… Downloads stay locked until access is confirmed.</p>
	if (access.status === 'error') return <p className="feature-access-notice is-error" role="alert">Could not verify plan access. Downloads are locked until access can be checked. {access.error}</p>
	if (access.allowed) return null
	return <p className="feature-access-notice" role="status">{access.active ? `Your active plan does not include ${featureName}.` : 'An active plan is required to download final files.'} <Link to="/pricing">View plans</Link></p>
}
