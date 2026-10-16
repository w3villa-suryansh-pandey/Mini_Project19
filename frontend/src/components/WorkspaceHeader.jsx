import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { getCurrentUser, signOut } from '../services/api.js'
import ThemeToggle from './ThemeToggle.jsx'
import logo from '../assets/logo.png'

const features = [
	{ label: 'PDF Editor', href: '/editor', icon: 'editor', description: 'Edit and sign PDF documents' },
	{ label: 'Presentation', href: '/presentation', icon: 'presentation', description: 'Create and edit slide decks' },
	{ label: 'Writing Pad', href: '/writing-pad', icon: 'writing-pad', description: 'Draft and format documents' },
	{ label: 'Image Tools', href: '/image-tools', icon: 'image', description: 'Work with image files' },
	{ label: 'Converter', href: '/converter', icon: 'converter', description: 'Convert files between formats' },
	{ label: 'Compressor', href: '/compressor', icon: 'compressor', description: 'Reduce file sizes' },
]

function FeatureIcon({ name }) {
	const paths = {
		editor: <><path d="M13 5 19 11M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="M12 20h8" /></>,
		presentation: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21l4-4 4 4M12 17v4M7 9h4m-4 4h10m-3-4h3" /></>,
		'writing-pad': <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /><path d="m17 16 3 3" /></>,
		image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M20 15l-4.2-4.2a1.6 1.6 0 0 0-2.2 0L9 16l-1.8-1.8a1.6 1.6 0 0 0-2.2 0L4 16" /></>,
		converter: <><path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" /></>,
		compressor: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
	}
	return <svg className="s19-feature-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function WorkspaceHeader() {
	const { pathname } = useLocation()
	const headerRef = useRef(null)
	const featureButtonRef = useRef(null)
	const [featuresOpen, setFeaturesOpen] = useState(false)
	const [accountOpen, setAccountOpen] = useState(false)
	const [mobileOpen, setMobileOpen] = useState(false)
	const [user, setUser] = useState(null)

	useEffect(() => {
		let current = true
		getCurrentUser().then(({ user: currentUser }) => { if (current) setUser(currentUser) }).catch(() => { if (current) setUser(null) })
		return () => { current = false }
	}, [])

	useEffect(() => {
		function handlePointerDown(event) {
			if (!headerRef.current?.contains(event.target)) {
				setFeaturesOpen(false)
				setAccountOpen(false)
			}
		}
		function handleKeyDown(event) {
			if (event.key === 'Escape') {
				setFeaturesOpen(false)
				setAccountOpen(false)
				setMobileOpen(false)
				featureButtonRef.current?.focus()
			}
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

	useEffect(() => {
		setFeaturesOpen(false)
		setAccountOpen(false)
		setMobileOpen(false)
	}, [pathname])

	async function handleSignOut() {
		await signOut().catch(() => undefined)
		window.location.assign('/')
	}

	function scrollToPageTop() {
		const page = headerRef.current?.closest('.dashboard-layout')
		page?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		document.scrollingElement?.scrollTo({ top: 0, behavior: 'smooth' })
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	const initial = (user?.name || user?.email || 'S').trim().charAt(0).toUpperCase()

	return (
		<header className="s19-topnav" ref={headerRef}>
			<div className="s19-topnav-inner">
				<button className="s19-topnav-brand" type="button" aria-label="Scroll to top of page" onClick={scrollToPageTop}>
					<img src={logo} alt="" />
					<span>S19</span>
				</button>
				<button className="s19-mobile-toggle" type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
					<span /><span /><span />
				</button>
				<nav className={`s19-primary-nav${mobileOpen ? ' is-open' : ''}`} aria-label="Main navigation">
					<NavLink to="/home" className={({ isActive }) => `s19-nav-link${isActive ? ' active' : ''}`}>Home</NavLink>
					<NavLink to="/dashboard" className={({ isActive }) => `s19-nav-link${isActive ? ' active' : ''}`}>Dashboard</NavLink>
					<div className={`s19-nav-dropdown-wrap${featuresOpen ? ' is-open' : ''}`} onMouseEnter={() => setFeaturesOpen(true)} onMouseLeave={() => setFeaturesOpen(false)}>
						<button ref={featureButtonRef} className={`s19-nav-link s19-nav-trigger${features.some((item) => pathname === item.href) ? ' active' : ''}`} type="button" aria-haspopup="true" aria-expanded={featuresOpen} aria-controls="s19-features-menu" onClick={() => setFeaturesOpen((open) => !open)}>
							Features <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg>
						</button>
						<div id="s19-features-menu" className="s19-features-menu" aria-hidden={!featuresOpen}>
							<div className="s19-features-menu-heading"><span>WORKSPACE TOOLS</span><small>Everything you need to work with files</small></div>
							<div className="s19-features-grid">{features.map((feature) => <NavLink key={feature.href} to={feature.href} className={({ isActive }) => `s19-feature-link${isActive ? ' active' : ''}`} tabIndex={featuresOpen ? 0 : -1}><span className="s19-feature-icon-wrap"><FeatureIcon name={feature.icon} /></span><span><b>{feature.label}</b><small>{feature.description}</small></span></NavLink>)}</div>
						</div>
					</div>
					<NavLink to="/pricing" className={({ isActive }) => `s19-nav-link${isActive ? ' active' : ''}`}>Plans</NavLink>
				</nav>
				<div className="s19-topnav-actions">
					<ThemeToggle />
					<div className={`s19-account-wrap${accountOpen ? ' is-open' : ''}`}>
						<button className="s19-account-trigger" type="button" aria-haspopup="true" aria-expanded={accountOpen} aria-controls="s19-account-menu" onClick={() => setAccountOpen((open) => !open)}>
							<span className="s19-account-avatar" aria-hidden="true">{user ? initial : <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5" /></svg>}</span><span className="s19-account-label">{user?.name?.split(' ')[0] || 'Account'}</span><svg className="s19-account-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg>
						</button>
						<div id="s19-account-menu" className="s19-account-menu" aria-hidden={!accountOpen}>
							{user ? <><div className="s19-account-summary"><span className="s19-account-summary-avatar" aria-hidden="true">{initial}</span><span className="s19-account-summary-copy"><b>{user.name || 'My account'}</b><small>{user.email}</small></span></div><Link className="s19-account-menu-item" to="/profile" tabIndex={accountOpen ? 0 : -1}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5" /></svg><span>Profile &amp; settings</span><span className="s19-account-menu-arrow" aria-hidden="true">›</span></Link><button className="s19-account-menu-item is-signout" type="button" tabIndex={accountOpen ? 0 : -1} onClick={handleSignOut}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8l4 4-4 4M18 12H7" /><path d="M11 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" /></svg><span>Sign out</span></button></> : <><Link className="s19-account-menu-item" to="/login" tabIndex={accountOpen ? 0 : -1}>Sign in</Link><Link className="s19-account-menu-item" to="/signup" tabIndex={accountOpen ? 0 : -1}>Create account</Link></>}
						</div>
					</div>
				</div>
			</div>
		</header>
	)
}

export default WorkspaceHeader
