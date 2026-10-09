import Sidebar from '../../components/Sidebar.jsx'

const toolOptions = [
  {
    id: 'passport',
    title: 'Create passport size photo',
    description: 'Generate a polished passport-style photo with the correct crop, framing, and clean output for official use.',
    badge: 'ID & visa',
    points: ['Auto crop to passport proportions', 'Clean framing and alignment', 'Optimize for print or upload'],
  },
  {
    id: 'background-remover',
    title: 'Background remover',
    description: 'Remove or soften the background from a portrait image so your subject stands out clearly and cleanly.',
    badge: 'Photo editing',
    points: ['Instant background cleanup', 'Keep focus on the subject', 'Ready for profile, social, or product use'],
  },
]

function ImageTools() {
  return (
    <main className="dashboard-layout image-tools-layout">
      <Sidebar active="/image-tools" />
      <section className="dashboard-content">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <div className="dashboard-breadcrumb">Workspace <span>/</span> Image tools</div>
          </div>
        </header>

        <div className="dashboard-main image-tools-main">
          <div className="dashboard-welcome">
            <div>
              <p className="dashboard-eyebrow">IMAGE STUDIO</p>
              <h1>Quick image fixes, ready to use.</h1>
              <p>Choose the job you need to complete and create a polished result without leaving your workspace.</p>
            </div>
          </div>

          <section className="image-tools-grid" aria-label="Image tools options">
            {toolOptions.map((tool) => (
              <article className="image-tool-card" key={tool.id}>
                <div className="image-tool-icon" aria-hidden="true">
                  {tool.id === 'passport' ? '📸' : '✨'}
                </div>
                <span className="image-tool-badge">{tool.badge}</span>
                <h2>{tool.title}</h2>
                <p>{tool.description}</p>
                <ul>
                  {tool.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <button type="button" className="image-tool-button">
                  Open {tool.title}
                </button>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  )
}

export default ImageTools
