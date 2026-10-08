import { signOut } from '../services/api.js'
import logo from '../assets/logo.png'

const adminNavigation = [
  { label: 'Overview', href: '/admin', icon: 'overview' },
  { label: 'Users', href: '/admin/users', icon: 'users' },
  { label: 'Pricing plans', href: '/admin/plans', icon: 'plans' },
  { label: 'Cron jobs', href: '/admin/cronjobs', icon: 'jobs' },
]

function AdminIcon({ name }) {
  const icons = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.5-3.2 2.3-4.8 5.5-4.8s5 1.6 5.5 4.8M16 5.5a3 3 0 0 1 0 5.8M17 15.3c2.2.5 3.4 2 3.8 4.7" /></>,
    plans: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h4" /></>,
    jobs: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  }

  return (
    <svg className="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

function AdminSidebar({ active = 'overview' }) {
  async function handleSignOut() {
    await signOut().catch(() => undefined)
    window.location.assign('/')
  }

  return (
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/admin" aria-label="S19 admin overview">
        <img className="admin-brand-mark" src={logo} alt="" />
        <span>19 <small>ADMIN</small></span>
      </a>
      <p className="admin-nav-label">MANAGE</p>
      <nav className="admin-nav" aria-label="Admin navigation">
        {adminNavigation.map((item) => (
          <a
            className={active === item.icon ? 'admin-nav-link active' : 'admin-nav-link'}
            href={item.href}
            key={item.icon}
            aria-current={active === item.icon ? 'page' : undefined}
          >
            <AdminIcon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="admin-sidebar-bottom">
        <button type="button" onClick={handleSignOut}>Sign out <span aria-hidden="true">↗</span></button>
      </div>
    </aside>
  )
}

export default AdminSidebar