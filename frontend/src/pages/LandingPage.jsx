import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import '../styles/aurora.css'
import { getPricingPlans } from '../services/api.js'
import { Link } from 'react-router-dom'

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

// Keep the backend's standard catalog visible if the public plans endpoint is unreachable.
const defaultPlans = [
	{
		id: 'day',
		name: 'Day pass',
		priceRupees: 10,
		durationValue: 1,
		durationUnit: 'day',
		features: ['PDF editing tools', 'Edited PDF downloads'],
	},
	{
		id: 'month',
		name: 'Monthly pass',
		priceRupees: 200,
		durationValue: 1,
		durationUnit: 'month',
		features: ['PDF editing tools', 'Edited PDF downloads'],
	},
]

const landingWelcomeTitle = 'Your Documents. Your Creativity. One Workspace.'
const landingWelcomePrefix = 'Your Documents. Your Creativity. '
const landingWelcomeAccent = 'One Workspace.'
const landingWelcomeDescription = 'Edit, convert, compress, and organize your documents with powerful tools designed to make everyday work effortless.'
const landingWelcomeVisitKey = 's19-landing-welcome-seen'

function LandingPage({ notice = '' }) {
	const [plans, setPlans] = useState(defaultPlans)
	const [plansLoading, setPlansLoading] = useState(true)
	const [plansError, setPlansError] = useState(false)
	const [headerScrolled, setHeaderScrolled] = useState(() => window.scrollY > 24)
	const [logoSpinKey, setLogoSpinKey] = useState(0)
	const [typedWelcomeLength, setTypedWelcomeLength] = useState(() => {
		try {
			return window.sessionStorage.getItem(landingWelcomeVisitKey) === 'true'
				? landingWelcomeTitle.length + landingWelcomeDescription.length
				: 0
		} catch {
			return 0
		}
	})

	function handleLandingLogoClick() {
		setLogoSpinKey((key) => key + 1)
		document.scrollingElement?.scrollTo({ top: 0, behavior: 'smooth' })
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	useEffect(() => {
		const updateHeader = () => setHeaderScrolled(window.scrollY > 24)
		window.addEventListener('scroll', updateHeader, { passive: true })
		updateHeader()
		return () => window.removeEventListener('scroll', updateHeader)
	}, [])

	useEffect(() => {
		const totalLength = landingWelcomeTitle.length + landingWelcomeDescription.length
		if (typedWelcomeLength >= totalLength) return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setTypedWelcomeLength(totalLength)
			try { window.sessionStorage.setItem(landingWelcomeVisitKey, 'true') } catch { /* storage may be disabled */ }
			return
		}

		const interval = window.setInterval(() => {
			setTypedWelcomeLength((length) => {
				const nextLength = Math.min(length + 1, totalLength)
				if (nextLength === totalLength) {
					window.clearInterval(interval)
					try { window.sessionStorage.setItem(landingWelcomeVisitKey, 'true') } catch { /* storage may be disabled */ }
				}
				return nextLength
			})
		}, 26)
		return () => window.clearInterval(interval)
	}, [typedWelcomeLength])

	useEffect(() => {
		let isCurrent = true
		getPricingPlans()
			.then(({ plans: availablePlans }) => {
				if (isCurrent) setPlans(availablePlans)
			})
			.catch(() => {
				if (isCurrent) setPlansError(true)
			})
			.finally(() => {
				if (isCurrent) setPlansLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	return (
		<main className="landing-page aurora-background">
			
               
                 <header className={`landing-header${headerScrolled ? ' is-scrolled' : ''}`}>
                   <div className="landing-header-inner landing-container">

                      <button className={`landing-brand landing-home-logo${logoSpinKey ? ' is-spinning' : ''}`} type="button" onClick={handleLandingLogoClick} aria-label="Scroll to top of page">
                          <img key={logoSpinKey} src={logo} alt="" />
                          <span>S19</span>
                       </button>

                        <nav className="landing-nav" aria-label="Main navigation">
  <a href="#home">Home</a>
  <a href="#tools">Tools</a>
  <a href="#features">Features</a>
  <a href="#pricing">Pricing</a>
  <a href="#about">About</a>
</nav>

                   <div className="landing-header-actions">
					 

                      <Link className="landing-login-link" to="/login">
                                 Log in
                        </Link>

                       <Link className="landing-signup-link" to="/signup">
                         Sign up
                        </Link>

                   </div>

                  </div>
                </header>


			{notice && <p className="landing-auth-notice landing-container" role="status">{notice} <Link to="/login">Return to sign in</Link></p>}

			<section className="landing-hero landing-container" id="home" aria-labelledby="landing-hero-title">
				<div className="landing-hero-copy">
					<div className="landing-hero-brand" aria-label="S19 workspace">
						<img src={logo} alt="" />
						<span>S19</span>
						<small><h2>WORKSPACE</h2></small>
					</div>
					
					<h1 id="landing-hero-title" aria-label={landingWelcomeTitle}>
						<span className="landing-welcome-reserve" aria-hidden="true">{landingWelcomePrefix}<span>{landingWelcomeAccent}</span></span>
						<span className="landing-welcome-typed" aria-hidden="true">
							{landingWelcomePrefix.slice(0, Math.min(typedWelcomeLength, landingWelcomePrefix.length))}
							{typedWelcomeLength > landingWelcomePrefix.length && <span>{landingWelcomeAccent.slice(0, typedWelcomeLength - landingWelcomePrefix.length)}</span>}
							{typedWelcomeLength < landingWelcomeTitle.length && <span className="landing-welcome-caret" />}
						</span>
					</h1>
					<p className="landing-hero-description" aria-label={landingWelcomeDescription}>
						<span className="landing-welcome-reserve" aria-hidden="true">{landingWelcomeDescription}</span>
						<span className="landing-welcome-typed" aria-hidden="true">
							{landingWelcomeDescription.slice(0, Math.max(0, typedWelcomeLength - landingWelcomeTitle.length))}
							{typedWelcomeLength > landingWelcomeTitle.length && typedWelcomeLength < landingWelcomeTitle.length + landingWelcomeDescription.length && <span className="landing-welcome-caret" />}
						</span>
					</p>
					<div className="landing-hero-actions">
						<Link className="landing-primary-button" to="/signup">Start Creating <span aria-hidden="true">→</span></Link>
						<a className="landing-secondary-button" href="#tools">
                           Explore Tools
                        </a>
					</div>
					<div className="landing-trust-note"><span aria-hidden="true">✓</span> <h2>A faster way to manage PDF and document tasks.</h2></div>
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
					
				</div>
			</section>

			<section className="landing-tools-strip landing-container" id="tools" aria-label="S19 tools">
				<span>DESIGNED FOR DAILY WORK</span>
				<strong>PDF editor</strong><i />
				<strong>Document editor</strong><i />
				<strong>File converter</strong><i />
				<strong>Writing pad</strong>
			</section>

			<section className="landing-features landing-container section-anchor" id="features" aria-labelledby="landing-features-title">
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
						</article>
					))}
				</div>
			</section>

			<section className="landing-workflow landing-container" aria-labelledby="landing-workflow-title">
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

			<section className="landing-file-tools-preview workspace-home-file-tools landing-container" aria-labelledby="landing-file-tools-title">
				<div className="workspace-home-file-tools-heading">
					<p className="dashboard-eyebrow">CONVERT &amp; COMPRESS</p>
					<h2 id="landing-file-tools-title">Make every file work better.</h2>
					<p>Switch formats or shrink large files with simple, focused tools.</p>
				</div>
				<div className="workspace-home-file-tools-grid">
					<article className="home-file-tool-card home-convert-card" aria-label="File conversion preview">
						<div className="home-file-tool-card-heading"><span className="home-file-tool-icon" aria-hidden="true">⇄</span><div><small>FILE CONVERTER</small><strong>Switch formats</strong></div><span className="home-file-tool-menu" aria-hidden="true">···</span></div>
						<div className="home-convert-flow"><div className="home-convert-file"><span className="home-format-icon format-docx">W</span><span><b>Project brief</b><small>Word document</small></span><strong>.DOCX</strong></div><span className="home-convert-arrow" aria-hidden="true">→</span><div className="home-convert-file result"><span className="home-format-icon format-pdf">PDF</span><span><b>Project brief</b><small>Ready to share</small></span><strong>.PDF</strong></div></div>
						<div className="home-file-tool-footer"><span><i /> Conversion preview</span><Link className="landing-preview-link" to="/signup">Try converter <span aria-hidden="true">↗</span></Link></div>
					</article>
					<article className="home-file-tool-card home-compress-card" aria-label="File compression preview">
						<div className="home-file-tool-card-heading"><span className="home-file-tool-icon compress-icon" aria-hidden="true">⌁</span><div><small>FILE COMPRESSOR</small><strong>Keep files lightweight</strong></div><span className="home-file-tool-menu" aria-hidden="true">···</span></div>
						<div className="home-compress-file"><span className="home-format-icon format-zip">▣</span><span><b>Project-assets.zip</b><small>Optimized for sharing</small></span><span className="home-compress-saved">−64%</span></div>
						<div className="home-compress-sizes"><span><small>ORIGINAL</small><b>24.8 <i>MB</i></b></span><span className="home-size-arrow" aria-hidden="true">→</span><span><small>COMPRESSED</small><b>8.9 <i>MB</i></b></span></div>
						<div className="home-compress-meter"><span /></div>
						<div className="home-file-tool-footer"><span><i /> Compression preview</span><Link className="landing-preview-link" to="/signup">Try compressor <span aria-hidden="true">↗</span></Link></div>
					</article>
				</div>
			</section>

			<section className="landing-benefits landing-container" aria-labelledby="landing-benefits-title">
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

			<section className="landing-pricing landing-container" id="pricing" aria-labelledby="landing-pricing-title">
				<div className="landing-section-heading compact">
					<div>
						<p className="landing-eyebrow">PLANS</p>
						<h2 id="landing-pricing-title">Flexible options for every workflow.</h2>
					</div>
				</div>
				<div className="landing-pricing-grid">
					{plans.map((plan) => (
						<div className="landing-price-card" key={plan.id}>
							<p className="landing-price-name">{plan.name}</p>
							<div className="landing-price-row">
								<span className="landing-price">₹{Number(plan.priceRupees).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
								<span className="landing-price-detail">/ {plan.durationValue} {plan.durationUnit}{plan.durationValue === 1 ? '' : 's'}</span>
							</div>
							<ul>
								{plan.features.map((feature) => <li key={feature}>{feature}</li>)}
							</ul>
							<Link to="/signup">Choose plan</Link>
						</div>
					))}
				</div>
				{plansLoading && <p className="landing-pricing-status" role="status">Checking current plan prices…</p>}
				{plansError && <p className="landing-pricing-status" role="status">Could not refresh current plans. Showing the standard prices.</p>}
				{!plansLoading && !plansError && plans.length === 0 && <p className="landing-pricing-status">No plans are currently available.</p>}
			</section>

			<section className="landing-about landing-container section-anchor" id="about" aria-labelledby="landing-about-title">
				<div className="landing-about-mark"><img src={logo} alt="" /><span>S19</span></div>
				<div className="landing-about-copy">
					<p className="landing-eyebrow">ABOUT S19</p>
					<h2 id="landing-about-title">A calmer home for your documents.</h2>
					<p>S19 combines document workflows and creative tools into one premium workspace. We focus on clarity, speed, and thoughtful design so your work feels easy from upload to export.</p>
				</div>
				<div className="landing-about-aside"><span>01</span><p>Simple by design.<br />Ready when you are.</p></div>
			</section>

			<section className="landing-cta landing-container" aria-labelledby="landing-cta-title">
				<div>
					<p className="landing-eyebrow">MAKE SPACE FOR YOUR NEXT IDEA</p>
					<h2 id="landing-cta-title">Ready to create something better?</h2>
					<p>Bring your document workflow together and get more done with less friction.</p>
				</div>
				<Link className="landing-primary-button" to="/signup">Start Now <span aria-hidden="true">→</span></Link>
			</section>

			<footer className="landing-footer landing-container">
				<button className={`landing-brand landing-home-logo${logoSpinKey ? ' is-spinning' : ''}`} type="button" onClick={handleLandingLogoClick} aria-label="Scroll to top of page">
					<img key={logoSpinKey} src={logo} alt="" />
					<span>S19</span>
				</button>
				<span>© 2026 S19. Made for clearer work.</span>
				<Link to="/login">Log in <span aria-hidden="true">↗</span></Link>
			</footer>
		</main>
	)
}

export default LandingPage

