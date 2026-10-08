import Sidebar from '../../components/Sidebar.jsx'

const destinations = [
	{
		number: '01',
		title: 'Your profile',
		description: 'Update your personal details and profile photo.',
		action: 'Manage profile',
		href: '/profile',
		icon: 'profile',
	},
	{
		number: '02',
		title: 'Pricing plans',
		description: 'Compare available plans and find the right fit.',
		action: 'View plans',
		href: '/pricing',
		icon: 'plans',
	},
	{
		number: '03',
		title: 'PDF editor',
		description: 'Open a PDF in your document workspace.',
		action: 'Open editor',
		href: '/editor',
		icon: 'editor',
	},
	{
		number: '04',
		title: 'Compress files',
		description: 'Reduce image and PDF file sizes right in your browser.',
		action: 'Compress files',
		href: '/compressor',
		icon: 'compressor',
	},
	{
		number: '05',
		title: 'Convert files',
		description: 'Convert images to PDFs, PDF pages to images, and image formats.',
		action: 'Convert files',
		href: '/converter',
		icon: 'converter',
	},
	{
		number: '06',
		title: 'Payments',
		description: 'Continue to payment and review your billing details.',
		action: 'Go to payments',
		href: '/payment',
		icon: 'payments',
	},
]

function DestinationIcon({ type }) {
	const icons = {
		profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5" /></>,
		plans: <><path d="M4 5h16M4 12h16M4 19h10" /><circle cx="7" cy="5" r="1" /><circle cx="17" cy="12" r="1" /></>,
		editor: <><path d="M13 5 19 11M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="M12 20h8" /></>,
		compressor: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6M9 17h6" /></>,
		converter: <><path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" /></>,
		payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-14 5h4" /></>,
	}

	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			{icons[type]}
		</svg>
	)
}

function UserDashboard() {
	return (
		<main className="dashboard-layout">
			<Sidebar />
			<section className="dashboard-content">
				<header className="dashboard-header">
					<div className="dashboard-breadcrumb">Workspace <span>/</span> Overview</div>
					<a className="dashboard-account-link" href="/profile">
						<span className="dashboard-account-avatar" aria-hidden="true">W</span>
						<span>My account</span>
					</a>
				</header>

				<div className="dashboard-main">
					<div className="dashboard-welcome">
						<p className="dashboard-eyebrow">YOUR WORKSPACE</p>
						<h1>Welcome to your dashboard</h1>
						<p>Choose where you’d like to go next.</p>
					</div>

					<section className="dashboard-destinations" aria-label="Account destinations">
						{destinations.map((destination) => (
							<a className="dashboard-destination" href={destination.href} key={destination.number}>
								<div className="destination-topline">
									<span className="destination-icon"><DestinationIcon type={destination.icon} /></span>
									<span className="destination-number">{destination.number}</span>
								</div>
								<h2>{destination.title}</h2>
								<p>{destination.description}</p>
								<span className="destination-action">
									{destination.action}<span aria-hidden="true">→</span>
								</span>
							</a>
						))}
					</section>

					<section className="dashboard-help">
						<div className="help-symbol" aria-hidden="true">i</div>
						<div>
							<h2>Need a hand?</h2>
							<p>Our team can help with your account, plans, or billing.</p>
						</div>
						<a href="mailto:support@w3villa.example">Contact support <span aria-hidden="true">↗</span></a>
					</section>
					<p className="dashboard-footnote">Account changes are managed securely in your workspace.</p>
				</div>
			</section>
		</main>
	)
}

export default UserDashboard
