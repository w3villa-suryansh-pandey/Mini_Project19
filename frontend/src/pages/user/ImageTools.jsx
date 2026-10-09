import { useMemo, useState } from 'react'
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

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('The selected image could not be loaded.'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('The selected image could not be read.'))
    reader.readAsDataURL(file)
  })
}

function createPassportImage(sourceImage) {
  const targetWidth = 413
  const targetHeight = 531
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, targetWidth, targetHeight)

  const sourceRatio = sourceImage.width / sourceImage.height
  const targetRatio = targetWidth / targetHeight

  let drawWidth = targetWidth
  let drawHeight = targetHeight
  let offsetX = 0
  let offsetY = 0

  if (sourceRatio > targetRatio) {
    drawHeight = targetHeight
    drawWidth = targetHeight * sourceRatio
    offsetX = (drawWidth - targetWidth) / -2
  } else {
    drawWidth = targetWidth
    drawHeight = targetWidth / sourceRatio
    offsetY = (drawHeight - targetHeight) / -2
  }

  context.drawImage(sourceImage, offsetX, offsetY, drawWidth, drawHeight)
  return canvas.toDataURL('image/png')
}

function createBackgroundRemovedImage(sourceImage) {
  const maxDimension = 1400
  const scale = Math.min(1, maxDimension / Math.max(sourceImage.width, sourceImage.height))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const width = Math.round(sourceImage.width * scale)
  const height = Math.round(sourceImage.height * scale)

  canvas.width = width
  canvas.height = height
  context.drawImage(sourceImage, 0, 0, width, height)

  const imageData = context.getImageData(0, 0, width, height)
  const pixels = imageData.data

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const maxChannel = Math.max(red, green, blue)
    const minChannel = Math.min(red, green, blue)
    const saturation = maxChannel - minChannel

    if (maxChannel > 235 && saturation < 28) {
      pixels[index + 3] = 0
    }
  }

  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function ImageTools() {
  const [selectedTool, setSelectedTool] = useState(toolOptions[0].id)
  const [selectedFile, setSelectedFile] = useState(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [resultPreview, setResultPreview] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [notice, setNotice] = useState('')

  const activeTool = useMemo(
    () => toolOptions.find((tool) => tool.id === selectedTool) || toolOptions[0],
    [selectedTool],
  )

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setNotice('')

    try {
      const image = await loadImageFromFile(file)
      setSourcePreview(image.src || URL.createObjectURL(file))
      setResultPreview('')
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function handleProcessImage() {
    if (!selectedFile) {
      setNotice('Please choose an image first.')
      return
    }

    setIsProcessing(true)
    setNotice('')

    try {
      const image = await loadImageFromFile(selectedFile)
      const processedDataUrl = selectedTool === 'passport'
        ? createPassportImage(image)
        : createBackgroundRemovedImage(image)

      setResultPreview(processedDataUrl)
      setNotice(`${activeTool.title} is ready.`)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleDownload() {
    if (!resultPreview) return
    const link = document.createElement('a')
    link.href = resultPreview
    link.download = `${selectedTool === 'passport' ? 'passport-photo' : 'background-removed'}-${Date.now()}.png`
    link.click()
  }

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
              <article
                className={selectedTool === tool.id ? 'image-tool-card active' : 'image-tool-card'}
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
              >
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
                  {selectedTool === tool.id ? 'Selected' : `Open ${tool.title}`}
                </button>
              </article>
            ))}
          </section>

          <section className="image-tool-workspace">
            <div className="image-tool-upload">
              <label htmlFor="image-tools-upload" className="image-tool-upload-label">
                Upload a photo
              </label>
              <input id="image-tools-upload" type="file" accept="image/*" onChange={handleFileChange} />
            </div>

            <div className="image-tool-actions">
              <button type="button" className="image-tool-primary" onClick={handleProcessImage} disabled={!selectedFile || isProcessing}>
                {isProcessing ? 'Processing…' : `Create ${activeTool.title.toLowerCase()}`}
              </button>
              <button type="button" className="image-tool-secondary" onClick={handleDownload} disabled={!resultPreview}>
                Download result
              </button>
            </div>

            {notice && <p className="image-tool-notice">{notice}</p>}

            <div className="image-tool-preview-grid">
              <div className="image-preview-panel">
                <h3>Original</h3>
                {sourcePreview ? <img src={sourcePreview} alt="Original upload preview" /> : <div className="image-preview-empty">Upload an image to begin</div>}
              </div>

              <div className="image-preview-panel">
                <h3>Result</h3>
                {resultPreview ? <img src={resultPreview} alt="Processed output" /> : <div className="image-preview-empty">Your processed file will appear here</div>}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default ImageTools
