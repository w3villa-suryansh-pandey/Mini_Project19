import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, signOut } from '../services/api.js'

function AccountBadge({ user: providedUser, variant = 'dashboard' }) {
	const [user, setUser] = useState(null)
	const [menuOpen, setMenuOpen] = useState(false)
	const badgeRef = useRef(null)

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

	useEffect(() => {
		if (variant !== 'admin') return undefined
		function handlePointerDown(event) {
			if (!badgeRef.current?.contains(event.target)) setMenuOpen(false)
		}
		function handleKeyDown(event) {
			if (event.key === 'Escape') setMenuOpen(false)
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [variant])

	const account = providedUser?.email ? providedUser : user || providedUser
	const name = account?.name || (account?.role === 'admin' ? 'Administrator' : 'My account')
	const initial = (account?.name || account?.email || 'S').trim().charAt(0).toUpperCase()

	if (variant === 'admin') {
		async function handleSignOut() {
			await signOut().catch(() => undefined)
			window.location.assign('/')
		}

		return (
			<div className={`s19-account-wrap admin-profile-menu${menuOpen ? ' is-open' : ''}`} ref={badgeRef}>
				<button className="s19-account-trigger" type="button" aria-haspopup="true" aria-expanded={menuOpen} aria-controls="admin-profile-menu" onClick={() => setMenuOpen((open) => !open)}>
					<span className="s19-account-avatar" aria-hidden="true">{initial}</span>
					<span className="s19-account-label">{account?.name?.split(' ')[0] || 'Profile'}</span>
					<svg className="s19-account-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg>
				</button>
				<div id="admin-profile-menu" className="s19-account-menu" aria-hidden={!menuOpen}>
					<div className="s19-account-summary"><b>{account?.name || name}</b><small>{account?.email || 'Administrator account'}</small></div>
					<Link to="/admin/profile" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>Admin profile</Link>
					<button type="button" tabIndex={menuOpen ? 0 : -1} onClick={handleSignOut}>Sign out</button>
				</div>
			</div>
		)
	}

	return (
		<Link className="dashboard-account-link" to="/profile" aria-label="Open account profile" title={name}>
			<span className="dashboard-account-avatar" aria-hidden="true">{initial}</span>
		</Link>
	)
}

export default AccountBadge
