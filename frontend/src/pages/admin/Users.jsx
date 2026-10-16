import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountBadge from '../../components/AccountBadge.jsx'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { getAdminUserDetails, getAdminUsers } from '../../services/api.js'
import { downloadAdminUserReport } from '../../utils/userReportPdf.js'

const PAGE_SIZE = 5

function Users() {
	const [users, setUsers] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [search, setSearch] = useState('')
	const [status, setStatus] = useState('All statuses')
	const [joinedMonth, setJoinedMonth] = useState('')
	const [sortOrder, setSortOrder] = useState('newest')
	const [page, setPage] = useState(1)
	const [selectedUserId, setSelectedUserId] = useState('')
	const [selectedUserDetails, setSelectedUserDetails] = useState(null)
	const [isDetailsLoading, setIsDetailsLoading] = useState(false)
	const [detailsError, setDetailsError] = useState('')

	useEffect(() => {
		let isCurrent = true
		getAdminUsers()
			.then((result) => {
				if (isCurrent) setUsers(result.users)
			})
			.catch((error) => {
				if (isCurrent) setLoadError(error.message)
			})
			.finally(() => {
				if (isCurrent) setIsLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	useEffect(() => {
		if (!selectedUserId) return undefined
		const previousOverflow = document.body.style.overflow
		function handleKeyDown(event) {
			if (event.key === 'Escape') closeUserDetails()
		}
		document.body.style.overflow = 'hidden'
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.body.style.overflow = previousOverflow
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [selectedUserId])

	const filteredUsers = users.filter((user) => {
		const matchesSearch = `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())
		const matchesStatus = status === 'All statuses' || user.status === status
		const joinedDate = new Date(user.createdAt)
		const monthKey = Number.isNaN(joinedDate.getTime()) ? '' : `${joinedDate.getFullYear()}-${String(joinedDate.getMonth() + 1).padStart(2, '0')}`
		const matchesMonth = !joinedMonth || monthKey === joinedMonth
		return matchesSearch && matchesStatus && matchesMonth
	}).sort((first, second) => {
		const difference = new Date(first.createdAt) - new Date(second.createdAt)
		return sortOrder === 'oldest' ? difference : -difference
	})
	const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
	const currentPage = Math.min(page, pageCount)
	const visibleUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
	const firstItem = filteredUsers.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
	const lastItem = Math.min(currentPage * PAGE_SIZE, filteredUsers.length)

	function resetPageOnChange(setter, value) {
		setter(value)
		setPage(1)
	}

	function clearFilters() {
		setSearch('')
		setStatus('All statuses')
		setJoinedMonth('')
		setSortOrder('newest')
		setPage(1)
	}

	async function showUserDetails(userId) {
		setSelectedUserId(userId)
		setSelectedUserDetails(null)
		setDetailsError('')
		setIsDetailsLoading(true)
		try {
			setSelectedUserDetails(await getAdminUserDetails(userId))
		} catch (error) {
			setDetailsError(error.message || 'Could not load user details.')
		} finally {
			setIsDetailsLoading(false)
		}
	}

	function closeUserDetails() {
		setSelectedUserId('')
		setSelectedUserDetails(null)
		setDetailsError('')
	}

	function downloadUserDetails() {
		downloadAdminUserReport(selectedUserDetails).catch((error) => {
			window.alert(error.message || 'Could not create the user PDF.')
		})
	}

	function handleUserRowKeyDown(event, userId) {
		if (event.target !== event.currentTarget) return
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			showUserDetails(userId)
		}
	}

	function formatDate(value, includeTime = false) {
		if (!value || Number.isNaN(new Date(value).getTime())) return '—'
		return new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value))
	}

	function formatCurrency(amountInPaise) {
		return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format((amountInPaise || 0) / 100)
	}

	const hasActiveFilters = Boolean(search || joinedMonth || status !== 'All statuses' || sortOrder !== 'newest')

	return (
		<main className="admin-layout">
			<AdminSidebar active="users" />
			<section className="admin-main-panel">
				<header className="admin-topbar">
					<div className="admin-breadcrumb">Administration <span>/</span> Users</div>
					<div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<AccountBadge variant="admin" /></div>
				</header>
				<div className="admin-content">
					<div className="admin-page-heading compact">
						<div><p className="admin-eyebrow">ACCOUNT MANAGEMENT</p><h1>Users</h1><p>Search, filter, and review workspace accounts.</p></div>
						<button className="admin-primary-button" type="button" onClick={() => window.alert('User invitations are not connected yet.')}>＋ Invite user</button>
					</div>

					<section className="admin-panel users-panel">
						<div className="users-panel-heading">
							<div><h2>User listing</h2><p>{filteredUsers.length} accounts found</p></div>
							<span className="admin-demo-tag">LIVE DATABASE</span>
						</div>
						<div className="users-toolbar">
							<label className="admin-search-wrap">
								<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
								<input type="search" placeholder="Search name or email" value={search} onChange={(event) => resetPageOnChange(setSearch, event.target.value)} aria-label="Search users" />
							</label>
							<label className="admin-filter-wrap"><span>Status</span><select value={status} onChange={(event) => resetPageOnChange(setStatus, event.target.value)} aria-label="Filter users by status"><option>All statuses</option><option>Active</option><option>Inactive</option></select></label>
							<label className="admin-filter-wrap"><span>Joined month</span><input className="admin-month-filter" type="month" value={joinedMonth} onChange={(event) => resetPageOnChange(setJoinedMonth, event.target.value)} aria-label="Filter users by joined month" /></label>
							<label className="admin-filter-wrap"><span>Sort</span><select value={sortOrder} onChange={(event) => resetPageOnChange(setSortOrder, event.target.value)} aria-label="Sort users by join date"><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>
							{hasActiveFilters && <button className="admin-clear-filters" type="button" onClick={clearFilters}>Clear filters</button>}
						</div>

						<div className="admin-table-scroll">
							<table className="admin-table">
								<thead><tr><th>User</th><th>Status</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
								<tbody>
									{visibleUsers.map((user) => (
										<tr key={user.id} className="admin-user-row" tabIndex="0" aria-label={`View details for ${user.name}`} onClick={(event) => { if (!event.target.closest('button')) showUserDetails(user.id) }} onKeyDown={(event) => handleUserRowKeyDown(event, user.id)}>
											<td><div className="table-user"><span className="admin-user-avatar sage">{user.name.split(' ').map((part) => part[0]).join('')}</span><button className="user-details-trigger" type="button" onClick={() => showUserDetails(user.id)}><strong>{user.name}</strong><small>{user.email}</small></button></div></td>
											<td><span className={`user-status ${user.status.toLowerCase()}`}><span />{user.status}</span></td>
											<td className="joined-date">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(user.createdAt))}</td>
											<td><button className="row-action user-details-action" type="button" aria-label={`View details for ${user.name}`} title="View user details" onClick={() => showUserDetails(user.id)}>↗</button></td>
										</tr>
									))}
									{visibleUsers.length === 0 && <tr><td className="empty-users" colSpan="4">{isLoading ? 'Loading users…' : loadError || (users.length ? 'No users match these filters.' : 'No user records found.')}</td></tr>}
								</tbody>
							</table>
						</div>

						<footer className="admin-pagination">
							<span>{filteredUsers.length ? `Showing ${firstItem}–${lastItem} of ${filteredUsers.length} users` : 'No users to display'}</span>
							<div className="pagination-controls">
								{filteredUsers.length > 0 && <>
									<button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} aria-label="Previous page">‹</button>
									{Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
										<button className={currentPage === pageNumber ? 'current' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)} aria-label={`Page ${pageNumber}`} aria-current={currentPage === pageNumber ? 'page' : undefined}>{pageNumber}</button>
									))}
									<button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage === pageCount} aria-label="Next page">›</button>
								</>}
							</div>
						</footer>
					</section>
				</div>
			</section>
			{selectedUserId && <div className="admin-user-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeUserDetails() }}>
				<section className="admin-user-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title" aria-busy={isDetailsLoading}>
					<header className="admin-user-dialog-header">
						<div><span className="admin-user-dialog-icon" aria-hidden="true">♙</span><div><p className="admin-eyebrow">ACCOUNT DETAILS</p><h2 id="admin-user-dialog-title">User information</h2></div></div>
						<button type="button" className="admin-user-dialog-close" onClick={closeUserDetails} aria-label="Close user information">×</button>
					</header>
					{isDetailsLoading ? <p className="admin-user-dialog-state">Loading user information…</p> : detailsError ? <p className="admin-user-dialog-state is-error" role="alert">{detailsError}</p> : selectedUserDetails && <>
						<div className="admin-user-dialog-identity">{selectedUserDetails.user.profilePicture ? <img className="admin-user-dialog-avatar" src={selectedUserDetails.user.profilePicture} alt={`${selectedUserDetails.user.name} profile`} /> : <span className="admin-user-dialog-avatar">{selectedUserDetails.user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>}<div><h3>{selectedUserDetails.user.name}</h3><p>{selectedUserDetails.user.email}</p></div><span className={`user-status ${selectedUserDetails.user.status.toLowerCase()}`}><span />{selectedUserDetails.user.status}</span><Link className="admin-user-more-link" to={`/admin/users/${selectedUserDetails.user.id}`}>More info <span aria-hidden="true">↗</span></Link></div>
						<div className="admin-user-profile-section-heading"><span>PROFILE INFORMATION</span><small>{[selectedUserDetails.user.name, selectedUserDetails.user.email, selectedUserDetails.user.phone, selectedUserDetails.user.address, selectedUserDetails.user.company, selectedUserDetails.user.jobTitle, selectedUserDetails.user.bio, selectedUserDetails.user.profilePicture].filter(Boolean).length}/8 profile details</small></div>
						<div className="admin-user-details-grid">
							<div><span>Phone</span><strong>{selectedUserDetails.user.phone || 'Not provided'}</strong></div>
							<div><span>Address</span><strong>{selectedUserDetails.user.address || 'Not provided'}</strong></div>
							<div><span>Company</span><strong>{selectedUserDetails.user.company || 'Not provided'}</strong></div>
							<div><span>Job title</span><strong>{selectedUserDetails.user.jobTitle || 'Not provided'}</strong></div>
							<div className="admin-user-about-detail"><span>About</span><strong>{selectedUserDetails.user.bio || 'No profile introduction provided.'}</strong></div>
						</div>
						<div className="admin-user-profile-section-heading"><span>ACCOUNT DETAILS</span></div>
						<div className="admin-user-details-grid">
							<div><span>Joined</span><strong>{formatDate(selectedUserDetails.user.createdAt)}</strong></div>
							<div><span>Last login</span><strong>{selectedUserDetails.user.lastLoginAt ? formatDate(selectedUserDetails.user.lastLoginAt, true) : 'No login recorded yet'}</strong></div>
							<div><span>Google sign-in</span><strong>{selectedUserDetails.user.googleLinked ? 'Connected' : 'Not connected'}</strong></div>
							<div><span>Facebook sign-in</span><strong>{selectedUserDetails.user.facebookLinked ? 'Connected' : 'Not connected'}</strong></div>
						</div>
						<section className="admin-user-purchase-card"><span className="admin-user-purchase-icon" aria-hidden="true">✦</span><div><p>LAST PURCHASED PLAN</p>{selectedUserDetails.lastPurchase ? <><h3>{selectedUserDetails.lastPurchase.planName}</h3><small>{formatDate(selectedUserDetails.lastPurchase.purchasedAt, true)} · Expires {formatDate(selectedUserDetails.lastPurchase.expiresAt, true)}</small></> : <><h3>No plan purchase yet</h3><small>This user has no recorded subscription purchase.</small></>}</div>{selectedUserDetails.lastPurchase && <strong>{formatCurrency(selectedUserDetails.lastPurchase.amountInPaise)}</strong>}</section>
						<div className="admin-user-dialog-footer"><button className="admin-secondary-button" type="button" onClick={closeUserDetails}>Close</button><button className="admin-primary-button" type="button" onClick={downloadUserDetails}>↓ Download PDF</button></div>
					</>}
				</section>
			</div>}
		</main>
	)
}

export default Users
