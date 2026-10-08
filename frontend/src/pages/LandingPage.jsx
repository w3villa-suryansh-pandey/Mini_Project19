import logo from '../assets/logo.png'

const features = [
	{
		number: '01',
		title: 'Edit PDFs',
		description: 'Make changes, add notes, rearrange pages, and prepare polished documents in your browser.',
		icon: <><path d="m14 5 5 5M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" /><path d="M12 20h8" /></>,
	},
	{
		number: '02',
		title: 'Convert files',
		description: 'Move between common document and image formats with a straightforward workflow.',
		icon: <><path d="M4 7h15l-3-3m4 13H5l3 3M4 7l3-3m13 13-3 3" /></>,
	},
	{
		number: '03',
		title: 'Compress files',
		description: 'Reduce file sizes for sharing while keeping your workflow simple and organized.',
		icon: <><path d="M12 3v12m0-12L8 7m4-4 4 4M5 14v6h14v-6" /></>,
	},
	{
		number: '04',
		title: 'Write freely',
		description: 'Capture notes and ideas in a clean writing space, right alongside your document tools.',
		icon: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /><path d="m17 16 3 3" /></>,
	},
]

function LandingPage({ notice = '' }) {
	return (
		<main className="landing-page">
			<header className="landing-header">
				<a className="landing-brand" href="/" aria-label="S19 home">
					<img src={logo} alt="" />
					<span>19</span>
				</a>
				<nav className="landing-nav" aria-label="Main navigation">
					<a href="#features">Features</a>
					<a href="#about">About</a>
				</nav>
				<div className="landing-header-actions">
					<a className="landing-login-link" href="/login">Log in</a>
					<a className="landing-signup-link" href="/signup">Get started <span aria-hidden="true">→</span></a>
				</div>
			</header>

			{notice && <p className="landing-auth-notice" role="status">{notice} <a href="/login">Return to sign in</a></p>}

			<section className="landing-hero" aria-labelledby="landing-hero-title">
				<div className="landing-hero-copy">
					<div className="landing-hero-brand" aria-label="S19 document workspace">
						<img src={logo} alt="" />
						<span>19</span>
						<small>DOCUMENT WORKSPACE</small>
					</div>
					<p className="landing-eyebrow"><span /> SIMPLE TOOLS, ONE CLEAR SPACE</p>
					<h1 id="landing-hero-title">Good work starts with <span>room to create.</span></h1>
					<p className="landing-hero-description">
						Edit PDFs, convert files, compress documents, and get your ideas down — all in one thoughtfully simple workspace.
					</p>
					<div className="landing-hero-actions">
						<a className="landing-primary-button" href="/signup">Create your free account <span aria-hidden="true">→</span></a>
						<a className="landing-secondary-button" href="/login">I already have an account</a>
					</div>
					<div className="landing-trust-note"><span aria-hidden="true">✓</span> Your files stay in your browser for local tools</div>
				</div>

				<div className="landing-visual" aria-label="Preview of the S19 document workspace">
					<div className="landing-visual-glow" />
					<div className="landing-document-card">
						<div className="landing-document-topbar">
							<span className="landing-document-badge">PDF</span>
							<span className="landing-document-title">Project brief.pdf</span>
							<span className="landing-document-menu" aria-hidden="true">···</span>
						</div>
						<div className="landing-document-page">
							<div className="landing-page-kicker">PROJECT OVERVIEW</div>
							<div className="landing-page-heading">A clearer way<br />to get things done.</div>
							<div className="landing-page-line landing-page-line-wide" />
							<div className="landing-page-line" />
							<div className="landing-page-line landing-page-line-short" />
							<div className="landing-page-highlight"><span /> Your next great idea starts here.</div>
							<div className="landing-page-line landing-page-line-wide" />
							<div className="landing-page-line landing-page-line-mid" />
						</div>
						<div className="landing-document-toolbar">
							<span className="landing-toolbar-active">Select</span>
							<span>Annotate</span>
							<span>Organize</span>
							<span className="landing-toolbar-download">↓</span>
						</div>
					</div>
					<div className="landing-float-note"><span aria-hidden="true">✦</span> Everything in its place</div>
				</div>
			</section>

			<section className="landing-tools-strip" aria-label="S19 tools">
				<span>MADE FOR YOUR EVERYDAY WORK</span>
				<strong>PDF editor</strong><i />
				<strong>File converter</strong><i />
				<strong>File compressor</strong><i />
				<strong>Writing pad</strong>
			</section>

			<section className="landing-features section-anchor" id="features" aria-labelledby="landing-features-title">
				<div className="landing-section-heading">
					<div>
						<p className="landing-eyebrow">A LITTLE LESS BUSYWORK</p>
						<h2 id="landing-features-title">Your tools, all together.</h2>
					</div>
					<p>Everything you need to work with documents, without the extra clutter.</p>
				</div>
				<div className="landing-feature-grid">
					{features.map((feature) => (
						<article className="landing-feature-card" key={feature.number}>
							<div className="landing-feature-card-top">
								<span className="landing-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{feature.icon}</svg></span>
								<span className="landing-feature-number">{feature.number}</span>
							</div>
							<h3>{feature.title}</h3>
							<p>{feature.description}</p>
						</article>
					))}
				</div>
			</section>

			<section className="landing-about section-anchor" id="about" aria-labelledby="landing-about-title">
				<div className="landing-about-mark"><img src={logo} alt="" /><span>19</span></div>
				<div className="landing-about-copy">
					<p className="landing-eyebrow">ABOUT S19</p>
					<h2 id="landing-about-title">A calmer home for your documents.</h2>
					<p>S19 brings practical document tools into one easy-to-use workspace. We focus on making common tasks feel clear and approachable, so you can spend less time managing files and more time moving your work forward.</p>
				</div>
				<div className="landing-about-aside"><span>01</span><p>Simple by design.<br />Ready when you are.</p></div>
			</section>

			<section className="landing-cta" aria-labelledby="landing-cta-title">
				<div>
					<p className="landing-eyebrow">MAKE SPACE FOR YOUR NEXT IDEA</p>
					<h2 id="landing-cta-title">Ready to get started?</h2>
					<p>Create an account and bring your document workflow together.</p>
				</div>
				<a className="landing-primary-button" href="/signup">Sign up for S19 <span aria-hidden="true">→</span></a>
			</section>

			<footer className="landing-footer">
				<a className="landing-brand" href="/" aria-label="S19 home">
					<img src={logo} alt="" />
					<span>19</span>
				</a>
				<span>© 2026 S19. Made for clearer work.</span>
				<a href="/login">Log in <span aria-hidden="true">↗</span></a>
			</footer>
		</main>
	)
}

export default LandingPage
