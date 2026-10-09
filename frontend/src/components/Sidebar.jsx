import { useState } from 'react'
import { signOut } from '../services/api.js'
import logo from '../assets/logo.png'

const navigationItems = [
	{ label: 'Overview', href: '/dashboard', icon: 'overview' },
	{ label: 'PDF Editor', href: '/editor', icon: 'editor' },
	{ label: 'Writing Pad', href: '/writing-pad', icon: 'writing-pad' },
	{ label: 'Image Tools', href: '/image-tools', icon: 'image' },
	{ label: 'Converter', href: '/converter', icon: 'converter' },
	{ label: 'Compressor', href: '/compressor', icon: 'compressor' },
	{ label: 'Pricing', href: '/pricing', icon: 'plans' },
	{ label: 'Account', href: '/profile', icon: 'profile' },
]

function NavIcon({ name }) {
	const paths = {
		overview: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="13" y="3" width="8" height="6" rx="1" /><rect x="3" y="13" width="6" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></>,
		profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5" /></>,
		plans: <><path d="M4 5h16M4 12h16M4 19h10" /><circle cx="7" cy="5" r="1" /><circle cx="17" cy="12" r="1" /></>,
		editor: <><path d="M13 5 19 11M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="M12 20h8" /></>,
		compressor: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
		converter: <><path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" /></>,
		'writing-pad': <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /><path d="m17 16 3 3" /></>,
		image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M20 15l-4.2-4.2a1.6 1.6 0 0 0-2.2 0L9 16l-1.8-1.8a1.6 1.6 0 0 0-2.2 0L4 16" /></>,
		payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-14 5h4" /></>,
	}

	return (
		<svg className="dashboard-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
			{paths[name]}
		</svg>
	)
}

function Sidebar({ active = '/dashboard' }) {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const path = typeof window !== 'undefined' ? window.location.pathname : active
	const activePath = navigationItems.some((item) => item.href === path) ? path : active

	async function handleSignOut() {
		await signOut().catch(() => undefined)
		window.location.assign('/')
	}

	return (
		<aside className={isCollapsed ? 'dashboard-sidebar is-collapsed' : 'dashboard-sidebar'}>
			<div className="dashboard-sidebar-header">
				<a className="dashboard-brand" href="/dashboard" aria-label="S19 dashboard">
					<img className="dashboard-brand-mark" src={logo} alt="" />
					<span>S19</span>
				</a>
				<button type="button" className="dashboard-sidebar-toggle" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
					{isCollapsed ? '→' : '←'}
				</button>
			</div>
			<div className="dashboard-nav-label">WORKSPACE</div>
			<nav className="dashboard-nav" aria-label="Dashboard navigation">
				{navigationItems.map((item) => (
					<a
						className={activePath === item.href ? 'dashboard-nav-link active' : 'dashboard-nav-link'}
						href={item.href}
						key={item.label}
						aria-current={activePath === item.href ? 'page' : undefined}
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
