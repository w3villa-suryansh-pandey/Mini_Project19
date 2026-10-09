import logo from '../assets/logo.png'

const featureCards = [
	{
		number: '01',
		title: 'PDF Editor',
		description: 'Mark up, refine, and organize PDF files with a clean workspace built for quick publishing and review.',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="m14 5 5 5M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" />
				<path d="M12 20h8" />
			</svg>
		),
		accent: 'indigo',
	},
	{
		number: '02',
		title: 'Document Editor',
		description: 'Draft polished documents, adjust structure, and keep your content easy to revisit and export.',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
			</svg>
		),
		accent: 'blue',
	},
	{
		number: '03',
		title: 'File Compressor',
		description: 'Reduce the size of PDFs and images without losing the parts that matter most to your workflow.',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6" />
			</svg>
		),
		accent: 'violet',
	},
	{
		number: '04',
		title: 'File Converter',
		description: 'Turn image and document formats into the output you need, all from a streamlined tool panel.',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" />
			</svg>
		),
		accent: 'cyan',
	},
	{
		number: '05',
		title: 'Writing Pad',
		description: 'Capture ideas, take notes, and sketch rough concepts in a flexible writing space.',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
				<path d="m17 16 3 3" />
			</svg>
		),
		accent: 'pink',
	},
]

const steps = [
	{ label: '01', title: 'Upload or create', description: 'Bring in an existing document or start a fresh file from the dashboard.' },
	{ label: '02', title: 'Choose your tool', description: 'Pick the format, action, or workspace that best fits the task at hand.' },
	{ label: '03', title: 'Finish and export', description: 'Edit, optimize, and download a polished result without leaving the workflow.' },
]

const benefitCards = [
	{ title: 'Built for busy teams', text: 'Keep everyday document work in one clear workspace, from review to export.' },
	{ title: 'Simple file flows', text: 'Convert, compress, and edit without bouncing between disjointed tools.' },
	{ title: 'Flexible productivity', text: 'Swap between PDF, writing, and document tasks while keeping context intact.' },
]

const pricingPreview = [
	{ name: 'Starter', price: '$12', detail: 'per month', featured: false },
	{ name: 'Pro', price: '$29', detail: 'per month', featured: true },
	{ name: 'Business', price: '$59', detail: 'per month', featured: false },
]

function LandingPage({ notice = '' }) {
	return (
		<main className="landing-page">
			<header className="landing-header">
				<a className="landing-brand" href="/" aria-label="S19 home">
					<img src={logo} alt="" />
					<span>S19</span>
				</a>
				<nav className="landing-nav" aria-label="Main navigation">
					<a href="#home">Home</a>
					<a href="#tools">Tools</a>
					<a href="#features">Features</a>
					<a href="#pricing">Pricing</a>
					<a href="#about">About</a>
				</nav>
				<div className="landing-header-actions">
					<a className="landing-login-link" href="/login">Log in</a>
					<a className="landing-signup-link" href="/signup">Start creating <span aria-hidden="true">→</span></a>
				</div>
			</header>

			{notice && <p className="landing-auth-notice" role="status">{notice} <a href="/login">Return to sign in</a></p>}

			<section className="landing-hero" id="home" aria-labelledby="landing-hero-title">
				<div className="landing-hero-copy">
					<div className="landing-hero-brand" aria-label="S19 workspace">
						<img src={logo} alt="" />
						<span>S19</span>
						<small>WORKSPACE</small>
					</div>
					<p className="landing-eyebrow"><span /> SMART TOOLS FOR MODERN WORK</p>
					<h1 id="landing-hero-title">Your Documents. Your Creativity. <span>One Workspace.</span></h1>
					<p className="landing-hero-description">
						Edit, convert, compress, and organize your documents with powerful tools designed to make everyday work effortless.
					</p>
					<div className="landing-hero-actions">
						<a className="landing-primary-button" href="/signup">Start Creating <span aria-hidden="true">→</span></a>
						<a className="landing-secondary-button" href="#tools">Explore Tools</a>
					</div>
					<div className="landing-trust-note"><span aria-hidden="true">✓</span> A faster way to manage PDF and document tasks.</div>
				</div>

				<div className="landing-visual" aria-label="Preview of the S19 document workspace">
					<div className="landing-visual-glow" />
					<div className="landing-document-card">
						<div className="landing-document-topbar">
							<span className="landing-document-badge">PDF</span>
							<span className="landing-document-title">Launch-plan.pdf</span>
							<span className="landing-document-menu" aria-hidden="true">···</span>
						</div>
						<div className="landing-document-page">
							<div className="landing-page-kicker">SEPTEMBER PLAN</div>
							<div className="landing-page-heading">A clearer way<br />to create momentum.</div>
							<div className="landing-page-line landing-page-line-wide" />
							<div className="landing-page-line" />
							<div className="landing-page-line landing-page-line-short" />
							<div className="landing-page-highlight"><span /> Save time. Ship faster. Stay focused.</div>
							<div className="landing-page-line landing-page-line-wide" />
							<div className="landing-page-line landing-page-line-mid" />
						</div>
						<div className="landing-document-toolbar">
							<span className="landing-toolbar-active">Edit</span>
							<span>Comment</span>
							<span>Share</span>
							<span className="landing-toolbar-download">↓</span>
						</div>
					</div>
					<div className="landing-float-note"><span aria-hidden="true">✦</span> Everything in one place</div>
				</div>
			</section>

			<section className="landing-tools-strip" id="tools" aria-label="S19 tools">
				<span>DESIGNED FOR DAILY WORK</span>
				<strong>PDF editor</strong><i />
				<strong>Document editor</strong><i />
				<strong>File converter</strong><i />
				<strong>Writing pad</strong>
			</section>

			<section className="landing-features section-anchor" id="features" aria-labelledby="landing-features-title">
				<div className="landing-section-heading">
					<div>
						<p className="landing-eyebrow">A LITTLE LESS BUSYWORK</p>
						<h2 id="landing-features-title">Everything your workflow needs.</h2>
					</div>
					<p>Move from documents to deliverables without slowing down your momentum.</p>
				</div>
				<div className="landing-feature-grid">
					{featureCards.map((feature) => (
						<article className={`landing-feature-card accent-${feature.accent}`} key={feature.number}>
							<div className="landing-feature-card-top">
								<span className="landing-feature-icon">{feature.icon}</span>
								<span className="landing-feature-number">{feature.number}</span>
							</div>
							<h3>{feature.title}</h3>
							<p>{feature.description}</p>
							<a href="/login" className="landing-feature-link">Explore tool <span aria-hidden="true">→</span></a>
						</article>
					))}
				</div>
			</section>

			<section className="landing-workflow" aria-labelledby="landing-workflow-title">
				<div className="landing-section-heading compact">
					<div>
						<p className="landing-eyebrow">HOW IT WORKS</p>
						<h2 id="landing-workflow-title">Three steps, zero clutter.</h2>
					</div>
				</div>
				<div className="landing-workflow-grid">
					{steps.map((step) => (
						<div className="landing-workflow-step" key={step.label}>
							<span className="landing-step-badge">{step.label}</span>
							<h3>{step.title}</h3>
							<p>{step.description}</p>
						</div>
					))}
				</div>
			</section>

			<section className="landing-benefits" aria-labelledby="landing-benefits-title">
				<div className="landing-benefits-copy">
					<p className="landing-eyebrow">WHY S19</p>
					<h2 id="landing-benefits-title">Built to keep work moving.</h2>
					<p>S19 brings document editing, file conversion, compression, and writing into a single premium workspace so your workflow stays focused and efficient.</p>
				</div>
				<div className="landing-benefit-grid">
					{benefitCards.map((benefit) => (
						<div className="landing-benefit-card" key={benefit.title}>
							<div className="landing-benefit-icon" aria-hidden="true">✦</div>
							<h3>{benefit.title}</h3>
							<p>{benefit.text}</p>
						</div>
					))}
				</div>
			</section>

			<section className="landing-pricing" id="pricing" aria-labelledby="landing-pricing-title">
				<div className="landing-section-heading compact">
					<div>
						<p className="landing-eyebrow">PLANS</p>
						<h2 id="landing-pricing-title">Flexible options for every workflow.</h2>
					</div>
				</div>
				<div className="landing-pricing-grid">
					{pricingPreview.map((plan) => (
						<div className={`landing-price-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
							<p className="landing-price-name">{plan.name}</p>
							<div className="landing-price-row">
								<span className="landing-price">{plan.price}</span>
								<span className="landing-price-detail">{plan.detail}</span>
							</div>
							<ul>
								<li>Core document tools</li>
								<li>Custom export options</li>
								<li>Priority project access</li>
							</ul>
							<a href="/pricing">Choose plan</a>
						</div>
					))}
				</div>
			</section>

			<section className="landing-about section-anchor" id="about" aria-labelledby="landing-about-title">
				<div className="landing-about-mark"><img src={logo} alt="" /><span>S19</span></div>
				<div className="landing-about-copy">
					<p className="landing-eyebrow">ABOUT S19</p>
					<h2 id="landing-about-title">A calmer home for your documents.</h2>
					<p>S19 combines document workflows and creative tools into one premium workspace. We focus on clarity, speed, and thoughtful design so your work feels easy from upload to export.</p>
				</div>
				<div className="landing-about-aside"><span>01</span><p>Simple by design.<br />Ready when you are.</p></div>
			</section>

			<section className="landing-cta" aria-labelledby="landing-cta-title">
				<div>
					<p className="landing-eyebrow">MAKE SPACE FOR YOUR NEXT IDEA</p>
					<h2 id="landing-cta-title">Ready to create something better?</h2>
					<p>Bring your document workflow together and get more done with less friction.</p>
				</div>
				<a className="landing-primary-button" href="/signup">Start for free <span aria-hidden="true">→</span></a>
			</section>

			<footer className="landing-footer">
				<a className="landing-brand" href="/" aria-label="S19 home">
					<img src={logo} alt="" />
					<span>S19</span>
				</a>
				<span>© 2026 S19. Made for clearer work.</span>
				<a href="/login">Log in <span aria-hidden="true">↗</span></a>
			</footer>
		</main>
	)
}

export default LandingPage

