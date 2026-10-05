const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV
	? 'http://localhost:5000'
	: 'https://mini-project19.onrender.com')
const USER_SESSION_CACHE_KEY = 'w3villa-user-session-verified'
const ADMIN_SESSION_CACHE_KEY = 'w3villa-admin-session-verified'

function cacheUserSession(user) {
	try {
		if (user?.role === 'user') {
			window.sessionStorage.setItem(USER_SESSION_CACHE_KEY, 'true')
			window.sessionStorage.removeItem(ADMIN_SESSION_CACHE_KEY)
		} else if (user?.role === 'admin') {
			window.sessionStorage.setItem(ADMIN_SESSION_CACHE_KEY, 'true')
			window.sessionStorage.removeItem(USER_SESSION_CACHE_KEY)
		} else {
			clearCachedUserSession()
		}
	} catch {
		// Session storage may be unavailable; protected routes will verify normally.
	}
}

export function hasCachedUserSession() {
	try {
		return window.sessionStorage.getItem(USER_SESSION_CACHE_KEY) === 'true'
	} catch {
		return false
	}
}

export function hasCachedAdminSession() {
	try {
		return window.sessionStorage.getItem(ADMIN_SESSION_CACHE_KEY) === 'true'
	} catch {
		return false
	}
}

export function cacheAdminSession() {
	try {
		window.sessionStorage.setItem(ADMIN_SESSION_CACHE_KEY, 'true')
	} catch {
		// Session storage may be unavailable; protected routes will verify normally.
	}
}

export function clearCachedAdminSession() {
	try {
		window.sessionStorage.removeItem(ADMIN_SESSION_CACHE_KEY)
	} catch {
		// Session storage may be unavailable.
	}
}

export function clearCachedUserSession() {
	try {
		window.sessionStorage.removeItem(USER_SESSION_CACHE_KEY)
		window.sessionStorage.removeItem(ADMIN_SESSION_CACHE_KEY)
	} catch {
		// Session storage may be unavailable.
	}
}

async function request(path, options = {}) {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		credentials: 'include',
		...options,
		headers: {
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...options.headers,
		},
	})
	const result = await response.json().catch(() => ({}))

	if (!response.ok) {
		if (response.status === 401) clearCachedUserSession()
		const error = new Error(result.error?.message || 'The request could not be completed.')
		error.code = result.error?.code
		error.status = response.status
		throw error
	}

	return result
}

export function signUp(credentials) {
	return request('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify(credentials),
	}).then((result) => {
		cacheUserSession(result.user)
		return result
	})
}

export function signIn(credentials) {
	return request('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify(credentials),
	}).then((result) => {
		cacheUserSession(result.user)
		return result
	})
}

export function verifyEmail(token) {
	return request('/api/auth/verify-email', {
		method: 'POST',
		body: JSON.stringify({ token }),
	})
}

export function signOut() {
	return request('/api/auth/logout', { method: 'POST' }).finally(clearCachedUserSession)
}

export function startGoogleLogin() {
	window.location.assign(`${API_BASE_URL}/api/auth/google`)
}

export function startGoogleLink() {
	window.location.assign(`${API_BASE_URL}/api/auth/google/link`)
}

export function startFacebookLogin() {
	window.location.assign(`${API_BASE_URL}/api/auth/facebook`)
}

export function startFacebookLink() {
	window.location.assign(`${API_BASE_URL}/api/auth/facebook/link`)
}

export function getAdminUsers() {
	return request('/api/admin/users')
}

export function getAdminActiveSubscriberCount() {
	return request('/api/admin/subscriptions/active-count')
}

export function getPricingPlans() {
	return request('/api/plans')
}

export function getAdminPlans() {
	return request('/api/admin/plans')
}

export function createAdminPlan(plan) {
	return request('/api/admin/plans', {
		method: 'POST',
		body: JSON.stringify(plan),
	})
}

export function updateAdminPlan(planId, plan) {
	return request(`/api/admin/plans/${encodeURIComponent(planId)}`, {
		method: 'PATCH',
		body: JSON.stringify(plan),
	})
}

export function deleteAdminPlan(planId) {
	return request(`/api/admin/plans/${encodeURIComponent(planId)}`, { method: 'DELETE' })
}

export function getSubscriptionExpiryJob() {
	return request('/api/admin/cronjobs/subscription-expiry')
}

export function createSubscriptionExpiryJob() {
	return request('/api/admin/cronjobs/subscription-expiry', { method: 'POST' })
}

export function deleteSubscriptionExpiryJob() {
	return request('/api/admin/cronjobs/subscription-expiry', { method: 'DELETE' })
}

export function setSubscriptionExpiryJobEnabled(enabled) {
	return request('/api/admin/cronjobs/subscription-expiry', {
		method: 'PATCH',
		body: JSON.stringify({ enabled }),
	})
}

export function runSubscriptionExpiryJob() {
	return request('/api/admin/cronjobs/subscription-expiry/run', { method: 'POST' })
}

export function getUserProfile() {
	return request('/api/users/profile')
}

export function updateUserProfile(profile) {
	return request('/api/users/profile', {
		method: 'PATCH',
		body: JSON.stringify(profile),
	})
}

export function getUserSubscription() {
	return request('/api/payments/subscription')
}

export function createRazorpayOrder(planId) {
	return request('/api/payments/checkout', {
		method: 'POST',
		body: JSON.stringify({ planId }),
	})
}

export function confirmRazorpayPayment(paymentDetails) {
	return request('/api/payments/confirm', {
		method: 'POST',
		body: JSON.stringify(paymentDetails),
	})
}

export function downloadUserProfile() {
	return fetch(`${API_BASE_URL}/api/users/profile/download`, {
		credentials: 'include',
	}).then(async (response) => {
		if (!response.ok) {
			const result = await response.json().catch(() => ({}))
			throw new Error(result.error?.message || 'The profile could not be downloaded.')
		}
		return response.blob()
	})
}
