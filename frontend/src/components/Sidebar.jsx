import { signOut } from '../services/api.js'

const navigationItems = [
	{ label: 'Overview', href: '/dashboard', icon: 'overview' },
	{ label: 'My profile', href: '/profile', icon: 'profile' },
	{ label: 'Pricing plans', href: '/pricing', icon: 'plans' },
	{ label: 'PDF editor', href: '/editor', icon: 'editor' },
	{ label: 'Compress files', href: '/compressor', icon: 'compressor' },
	{ label: 'Payments', href: '/payment', icon: 'payments' },
]

function NavIcon({ name }) {
	const paths = {
		overview: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="13" y="3" width="8" height="6" rx="1" /><rect x="3" y="13" width="6" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></>,
		profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5" /></>,
		plans: <><path d="M4 5h16M4 12h16M4 19h10" /><circle cx="7" cy="5" r="1" /><circle cx="17" cy="12" r="1" /></>,
		editor: <><path d="M13 5 19 11M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="M12 20h8" /></>,
		compressor: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
		payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-14 5h4" /></>,
	}

	return (
		<svg className="dashboard-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
			{paths[name]}
		</svg>
	)
}

function Sidebar({ active = 'overview' }) {
	async function handleSignOut() {
		await signOut().catch(() => undefined)
		window.location.assign('/')
	}

	return (
		<aside className="dashboard-sidebar">
			<a className="dashboard-brand" href="/dashboard" aria-label="W3 dashboard">
				<span className="dashboard-brand-mark" aria-hidden="true">W3</span>
				<span>W3</span>
			</a>
			<div className="dashboard-nav-label">WORKSPACE</div>
			<nav className="dashboard-nav" aria-label="Dashboard navigation">
				{navigationItems.map((item) => (
					<a
						className={active === item.icon ? 'dashboard-nav-link active' : 'dashboard-nav-link'}
						href={item.href}
						key={item.icon}
						aria-current={active === item.icon ? 'page' : undefined}
					>
						<NavIcon name={item.icon} />
						<span>{item.label}</span>
					</a>
				))}
			</nav>
			<div className="dashboard-sidebar-bottom">
				<button className="dashboard-signout" type="button" onClick={handleSignOut}>Sign out <span aria-hidden="true">↗</span></button>
			</div>
		</aside>
	)
}

export default Sidebar
