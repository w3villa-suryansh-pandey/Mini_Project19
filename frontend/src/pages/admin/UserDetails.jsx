import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AccountBadge from '../../components/AccountBadge.jsx'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { getAdminUserDetails } from '../../services/api.js'
import { getPlanFeatureLabels } from '../../utils/planFeatures.js'

function formatDate(value, includeTime = false) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value))
}

function formatCurrency(amountInPaise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format((amountInPaise || 0) / 100)
}

function csvCell(value) {
  const text = String(value ?? '')
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

function UserDetails() {
  const { userId } = useParams()
  const [details, setDetails] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setError('')
    getAdminUserDetails(userId)
      .then((data) => { if (isCurrent) setDetails(data) })
      .catch((loadError) => { if (isCurrent) setError(loadError.message || 'Could not load user details.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [userId])

  function downloadHistory() {
    if (!details) return
    const { user, purchases = [] } = details
    const rows = [
      ['S19 user report', ''],
      ['Name', user.name], ['Email', user.email], ['Status', user.status],
      ['Joined', formatDate(user.createdAt)], ['Last login', user.lastLoginAt ? formatDate(user.lastLoginAt, true) : 'No login recorded'],
      ['Phone', user.phone || 'Not provided'], ['Address', user.address || 'Not provided'],
      ['Company', user.company || 'Not provided'], ['Job title', user.jobTitle || 'Not provided'],
      ['About', user.bio || 'Not provided'], ['Profile photo', user.profilePicture || 'Not set'],
      ['Google sign-in', user.googleLinked ? 'Connected' : 'Not connected'], ['Facebook sign-in', user.facebookLinked ? 'Connected' : 'Not connected'],
      [], ['Purchase history', ''],
      ['Plan', 'Purchase date', 'Price', 'Duration', 'Status', 'Features', 'Starts', 'Expires'],
      ...purchases.map((purchase) => [
        purchase.planName,
        formatDate(purchase.purchasedAt, true),
        formatCurrency(purchase.amountInPaise),
        `${purchase.durationValue} ${purchase.durationUnit}${purchase.durationValue === 1 ? '' : 's'}`,
        purchase.status,
        getPlanFeatureLabels(purchase.featureKeys).join('; '),
        formatDate(purchase.startsAt, true),
        formatDate(purchase.expiresAt, true),
      ]),
    ]
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `s19-user-history-${user.email.replace(/[^a-z0-9]+/gi, '-')}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const user = details?.user
  const purchases = details?.purchases || []
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'
  const profileValues = user ? [user.name, user.email, user.phone, user.address, user.company, user.jobTitle, user.bio, user.profilePicture] : []
  const profileCompletion = profileValues.length ? Math.round(profileValues.filter(Boolean).length / profileValues.length * 100) : 0

  return (
    <main className="admin-layout admin-user-full-page">
      <AdminSidebar active="users" />
      <section className="admin-main-panel">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">Administration <span>/</span> <Link to="/admin/users">Users</Link> <span>/</span> User details</div>
          <div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<AccountBadge variant="admin" /></div>
        </header>
        <div className="admin-content admin-user-full-content">
          <div className="admin-page-heading">
            <div><p className="admin-eyebrow">ACCOUNT MANAGEMENT</p><h1>User details</h1><p>Full profile and subscription purchase history.</p></div>
            <div className="admin-user-full-actions"><Link className="admin-secondary-button" to="/admin/users">← Back to users</Link><button className="admin-primary-button" type="button" onClick={downloadHistory} disabled={!details}>↓ Download report</button></div>
          </div>
          {isLoading && <div className="admin-panel admin-user-full-state" role="status">Loading user information…</div>}
          {!isLoading && error && <div className="admin-panel admin-user-full-state is-error" role="alert">{error}<p><Link to="/admin/users">Return to user listing</Link></p></div>}
          {!isLoading && user && <>
            <section className="admin-user-profile-hero">
              {user.profilePicture ? <img className="admin-user-full-avatar" src={user.profilePicture} alt={`${user.name} profile`} /> : <span className="admin-user-full-avatar">{initials}</span>}
              <div className="admin-user-full-identity"><p className="admin-eyebrow">USER PROFILE</p><h2>{user.name}</h2><p>{user.email}</p><span className={`user-status ${user.status.toLowerCase()}`}><span />{user.status} account</span></div>
              <div className="admin-user-full-completion"><strong>{profileCompletion}<small>%</small></strong><span>profile complete</span><div><i style={{ width: `${profileCompletion}%` }} /></div></div>
            </section>

            <div className="admin-user-full-grid">
              <section className="admin-panel admin-user-full-panel">
                <div className="admin-user-full-panel-heading"><span className="admin-user-full-panel-icon violet" aria-hidden="true">✦</span><div><h2>Profile information</h2><p>Personal and contact details</p></div></div>
                <dl className="admin-user-full-fields">
                  <div><dt>Full name</dt><dd>{user.name}</dd></div>
                  <div><dt>Email address</dt><dd>{user.email}</dd></div>
                  <div><dt>Phone number</dt><dd>{user.phone || 'Not provided'}</dd></div>
                  <div><dt>Address</dt><dd>{user.address || 'Not provided'}</dd></div>
                  <div><dt>Company</dt><dd>{user.company || 'Not provided'}</dd></div>
                  <div><dt>Job title</dt><dd>{user.jobTitle || 'Not provided'}</dd></div>
                  <div className="admin-user-full-about"><dt>About</dt><dd>{user.bio || 'No profile introduction provided.'}</dd></div>
                </dl>
              </section>
              <section className="admin-panel admin-user-full-panel">
                <div className="admin-user-full-panel-heading"><span className="admin-user-full-panel-icon blue" aria-hidden="true">◎</span><div><h2>Account activity</h2><p>Sign-in and connected account details</p></div></div>
                <dl className="admin-user-full-fields single">
                  <div><dt>Account status</dt><dd><span className={`user-status ${user.status.toLowerCase()}`}><span />{user.status}</span></dd></div>
                  <div><dt>Joined</dt><dd>{formatDate(user.createdAt, true)}</dd></div>
                  <div><dt>Last login</dt><dd>{user.lastLoginAt ? formatDate(user.lastLoginAt, true) : 'No login recorded yet'}</dd></div>
                  <div><dt>Google sign-in</dt><dd><span className={`user-provider-status${user.googleLinked ? ' connected' : ''}`}>{user.googleLinked ? 'Connected' : 'Not connected'}</span></dd></div>
                  <div><dt>Facebook sign-in</dt><dd><span className={`user-provider-status${user.facebookLinked ? ' connected' : ''}`}>{user.facebookLinked ? 'Connected' : 'Not connected'}</span></dd></div>
                </dl>
              </section>
            </div>

            <section className="admin-panel admin-user-history-panel">
              <div className="admin-user-full-panel-heading"><span className="admin-user-full-panel-icon amber" aria-hidden="true">₹</span><div><h2>Plan purchase history</h2><p>{purchases.length} subscription purchase{purchases.length === 1 ? '' : 's'} recorded, newest first</p></div></div>
              {purchases.length ? <div className="admin-user-history-list">{purchases.map((purchase, index) => <article className="admin-user-history-item" key={purchase.id}>
                <span className={`admin-user-history-marker tone-${index % 4}`} aria-hidden="true">{index + 1}</span>
                <div className="admin-user-history-main"><div className="admin-user-history-title"><div><h3>{purchase.planName}</h3><p>Purchased {formatDate(purchase.purchasedAt, true)}</p></div><span className={`user-status ${purchase.status === 'active' ? 'active' : 'inactive'}`}><span />{purchase.status === 'active' ? 'Active' : 'Expired'}</span></div>
                  <div className="admin-user-history-meta"><span><small>PRICE</small><strong>{formatCurrency(purchase.amountInPaise)}</strong></span><span><small>DURATION</small><strong>{purchase.durationValue} {purchase.durationUnit}{purchase.durationValue === 1 ? '' : 's'}</strong></span><span><small>STARTS</small><strong>{formatDate(purchase.startsAt)}</strong></span><span><small>EXPIRES</small><strong>{formatDate(purchase.expiresAt)}</strong></span></div>
                  <div className="admin-user-history-features"><small>ENABLED FEATURES</small>{getPlanFeatureLabels(purchase.featureKeys).length ? getPlanFeatureLabels(purchase.featureKeys).map((feature) => <span key={feature}>{feature}</span>) : <em>No feature access</em>}</div>
                </div>
              </article>)}</div> : <div className="admin-user-history-empty"><span aria-hidden="true">◇</span><h3>No purchases yet</h3><p>Subscription purchases for this user will appear here.</p></div>}
            </section>
          </>}
        </div>
      </section>
    </main>
  )
}

export default UserDetails
