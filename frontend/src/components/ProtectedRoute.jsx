import { useEffect, useState } from 'react'
import { clearCachedUserSession, hasCachedUserSession } from '../services/api.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function ProtectedRoute({ children, requiredRole = 'admin' }) {
	const [accessState, setAccessState] = useState('checking')

	useEffect(() => {
		const controller = new AbortController()
		if (requiredRole === 'user' && hasCachedUserSession()) {
			setAccessState('allowed')
			return () => controller.abort()
		}

		const endpoint = requiredRole === 'admin' ? '/api/admin' : '/api/auth/me'

		fetch(`${API_URL}${endpoint}`, {
			credentials: 'include',
			signal: controller.signal,
		})
			.then(async (response) => {
				if (response.status === 401) {
					clearCachedUserSession()
					setAccessState('unauthenticated')
				} else if (response.status === 403) {
					setAccessState('forbidden')
				} else if (response.ok && requiredRole === 'admin') {
					setAccessState('allowed')
				} else if (response.ok) {
					setAccessState('allowed')
				} else {
					setAccessState('unavailable')
				}
			})
			.catch((error) => {
				if (error.name !== 'AbortError') {
					setAccessState('unavailable')
				}
			})

		return () => controller.abort()
	}, [requiredRole])

	if (accessState === 'allowed') {
		return children
	}

	const roleLabel = requiredRole === 'admin' ? 'admin' : 'user'
	const title = accessState === 'checking'
		? `Checking ${roleLabel} access`
		: accessState === 'forbidden'
			? `${requiredRole === 'admin' ? 'Admin' : 'User'} access required`
			: accessState === 'unavailable'
				? `${requiredRole === 'admin' ? 'Admin' : 'Account'} service unavailable`
				: 'Sign in required'
	const message = accessState === 'checking'
		? 'Verifying your account permissions.'
		: accessState === 'forbidden'
			? 'This account does not have permission to open the admin panel.'
			: accessState === 'unavailable'
				? `Could not verify ${roleLabel} access. Try again when the API is available.`
				: `Sign in with an ${roleLabel} account to continue.`

	return (
		<main className="admin-access-page">
			<section className="admin-access-message" aria-live="polite">
				<span className="admin-access-mark" aria-hidden="true">W</span>
				<p className="admin-eyebrow">W3 {requiredRole.toUpperCase()}</p>
				<h1>{title}</h1>
				<p>{message}</p>
				{accessState !== 'checking' && <a href="/">Return to sign in</a>}
			</section>
		</main>
	)
}

export default ProtectedRoute
