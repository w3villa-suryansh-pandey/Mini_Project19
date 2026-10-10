import { useEffect, useState } from 'react'
import { getCurrentUser } from '../services/api.js'

function AccountBadge({ user: providedUser, variant = 'dashboard' }) {
	const [user, setUser] = useState(null)
	const [loadError, setLoadError] = useState('')

	useEffect(() => {
		if (providedUser?.email) return undefined

		let isCurrent = true
		getCurrentUser()
			.then(({ user: currentUser }) => {
				if (isCurrent) setUser(currentUser)
			})
			.catch((error) => {
				if (isCurrent) setLoadError(error.message)
			})

		return () => { isCurrent = false }
	}, [providedUser?.email])

	const account = providedUser?.email ? providedUser : user || providedUser
	const email = account?.email || (loadError ? 'Account unavailable' : 'Loading email…')
	const name = account?.name || (account?.role === 'admin' ? 'Administrator' : 'My account')
	const initial = (account?.name || account?.email || 'S').trim().charAt(0).toUpperCase()
	const details = <span className="account-badge-details">
		<strong title={account?.email || undefined}>{email}</strong>
		<small>{!account?.email && loadError ? loadError : name}</small>
	</span>

	if (variant === 'admin') {
		return (
			<span className="admin-account-badge">
				<span className="admin-topbar-avatar" aria-hidden="true">{initial}</span>
				{details}
			</span>
		)
	}

	return (
		<a className="dashboard-account-link" href="/profile" aria-label={account?.email ? `Signed in as ${account.email}` : email}>
			<span className="dashboard-account-avatar" aria-hidden="true">{initial}</span>
			{details}
		</a>
	)
}

export default AccountBadge
