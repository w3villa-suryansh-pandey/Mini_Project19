import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '../services/api.js'

function AccountBadge({ user: providedUser, variant = 'dashboard' }) {
	const [user, setUser] = useState(null)

	useEffect(() => {
		if (providedUser?.email) return undefined

		let isCurrent = true
		getCurrentUser()
			.then(({ user: currentUser }) => {
				if (isCurrent) setUser(currentUser)
			})
			.catch(() => undefined)

		return () => { isCurrent = false }
	}, [providedUser?.email])

	const account = providedUser?.email ? providedUser : user || providedUser
	const name = account?.name || (account?.role === 'admin' ? 'Administrator' : 'My account')
	const initial = (account?.name || account?.email || 'S').trim().charAt(0).toUpperCase()

	if (variant === 'admin') {
		return (
			<span className="admin-account-badge" role="img" aria-label={`${name} avatar`}>
				<span className="admin-topbar-avatar" aria-hidden="true">{initial}</span>
			</span>
		)
	}

	return (
		<Link className="dashboard-account-link" to="/profile" aria-label="Open account profile" title={name}>
			<span className="dashboard-account-avatar" aria-hidden="true">{initial}</span>
		</Link>
	)
}

export default AccountBadge
