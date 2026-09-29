import { useEffect, useState } from 'react'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { getAdminUsers } from '../../services/api.js'

const PAGE_SIZE = 5

function Users() {
	const [users, setUsers] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [search, setSearch] = useState('')
	const [status, setStatus] = useState('All statuses')
	const [page, setPage] = useState(1)

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

	const filteredUsers = users.filter((user) => {
		const matchesSearch = `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())
		const matchesStatus = status === 'All statuses' || user.status === status
		return matchesSearch && matchesStatus
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

	return (
		<main className="admin-layout">
			<AdminSidebar active="users" />
			<section className="admin-main-panel">
				<header className="admin-topbar">
					<div className="admin-breadcrumb">Administration <span>/</span> Users</div>
					<div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<span className="admin-topbar-avatar">AD</span></div>
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
						</div>

						<div className="admin-table-scroll">
							<table className="admin-table">
								<thead><tr><th>User</th><th>Status</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
								<tbody>
									{visibleUsers.map((user) => (
										<tr key={user.id}>
											<td><div className="table-user"><span className="admin-user-avatar sage">{user.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
											<td><span className={`user-status ${user.status.toLowerCase()}`}><span />{user.status}</span></td>
											<td className="joined-date">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(user.createdAt))}</td>
											<td><button className="row-action" type="button" aria-label={`More actions for ${user.name}`} onClick={() => window.alert(`User actions for ${user.name} are not connected yet.`)}>···</button></td>
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
		</main>
	)
}

export default Users
