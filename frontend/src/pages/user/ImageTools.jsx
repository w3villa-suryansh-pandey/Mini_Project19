import { useMemo, useState } from 'react'
import { createWorker } from 'tesseract.js'
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
    description: 'Remove a plain or near-solid background from a portrait while preserving the subject.',
    badge: 'Photo editing',
    points: ['Detect background color from image edges', 'Preserve disconnected foreground details', 'Best results with plain backgrounds'],
  },
  {
    id: 'text-extractor',
    title: 'Extract text from image',
    description: 'Recognize printed text in an image and copy or download the extracted result.',
    badge: 'OCR',
    points: ['Recognize text in common image formats', 'Choose the text language', 'Copy or save the result as a text file'],
  },
]

const ocrLanguages = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'hin', label: 'Hindi' },
  { code: 'ara', label: 'Arabic' },
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
  const width = Math.round(sourceImage.width * scale)
  const height = Math.round(sourceImage.height * scale)

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not start image processing.')

  context.drawImage(sourceImage, 0, 0, width, height)

  const imageData = context.getImageData(0, 0, width, height)
  const pixels = imageData.data
  const pixelCount = width * height
  const bins = new Map()
  const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 500))

  function recordEdgePixel(x, y) {
    const offset = (y * width + x) * 4
    if (pixels[offset + 3] < 128) return
    const red = pixels[offset]
    const green = pixels[offset + 1]
    const blue = pixels[offset + 2]
    const key = `${red >> 4},${green >> 4},${blue >> 4}`
    const bin = bins.get(key) || { count: 0, red: 0, green: 0, blue: 0 }
    bin.count += 1
    bin.red += red
    bin.green += green
    bin.blue += blue
    bins.set(key, bin)
  }

  for (let x = 0; x < width; x += sampleStep) {
    recordEdgePixel(x, 0)
    if (height > 1) recordEdgePixel(x, height - 1)
  }
  for (let y = sampleStep; y < height - 1; y += sampleStep) {
    recordEdgePixel(0, y)
    if (width > 1) recordEdgePixel(width - 1, y)
  }

  const dominantBin = [...bins.values()].reduce(
    (dominant, bin) => bin.count > (dominant?.count || 0) ? bin : dominant,
    null,
  )
  if (!dominantBin) throw new Error('The image has no usable edge pixels for background detection.')

  const background = [
    dominantBin.red / dominantBin.count,
    dominantBin.green / dominantBin.count,
    dominantBin.blue / dominantBin.count,
  ]
  const visited = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)
  const matchDistance = 72
  const fullyTransparentDistance = 24
  let queueStart = 0
  let queueEnd = 0

  function addIfBackground(pixelIndex) {
    if (visited[pixelIndex]) return
    const offset = pixelIndex * 4
    if (pixels[offset + 3] === 0) {
      visited[pixelIndex] = 1
      return
    }
    const redDistance = pixels[offset] - background[0]
    const greenDistance = pixels[offset + 1] - background[1]
    const blueDistance = pixels[offset + 2] - background[2]
    const colorDistance = Math.sqrt(
      redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance,
    )
    if (colorDistance > matchDistance) return

    visited[pixelIndex] = 1
    const opacity = Math.max(
      0,
      Math.min(255, ((colorDistance - fullyTransparentDistance) / (matchDistance - fullyTransparentDistance)) * 255),
    )
    pixels[offset + 3] = Math.round(pixels[offset + 3] * opacity / 255)
    queue[queueEnd++] = pixelIndex
  }

  for (let x = 0; x < width; x += 1) {
    addIfBackground(x)
    if (height > 1) addIfBackground((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    addIfBackground(y * width)
    if (width > 1) addIfBackground(y * width + width - 1)
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart++]
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    if (x > 0) addIfBackground(pixelIndex - 1)
    if (x < width - 1) addIfBackground(pixelIndex + 1)
    if (y > 0) addIfBackground(pixelIndex - width)
    if (y < height - 1) addIfBackground(pixelIndex + width)
  }

  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function ImageTools() {
  const [selectedTool, setSelectedTool] = useState(toolOptions[0].id)
  const [selectedFile, setSelectedFile] = useState(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [resultPreview, setResultPreview] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [ocrLanguage, setOcrLanguage] = useState('eng')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
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
    setResultPreview('')
    setExtractedText('')
    setProgress(0)

    try {
      const image = await loadImageFromFile(file)
      setSourcePreview(image.src || URL.createObjectURL(file))
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
    setProgress(0)

    try {
      if (selectedTool === 'text-extractor') {
        const worker = await createWorker(ocrLanguage, undefined, {
          logger: ({ status, progress: taskProgress }) => {
            if (typeof taskProgress === 'number') {
              setProgress(Math.round(taskProgress * 100))
              setNotice(status === 'recognizing text' ? 'Reading text from image…' : 'Preparing text recognition…')
            }
          },
        })

        try {
          const { data } = await worker.recognize(selectedFile)
          const text = data.text.trim()
          setExtractedText(text)
          setNotice(text ? 'Text extraction is complete.' : 'No text was detected. Try a clearer image.')
        } finally {
          await worker.terminate()
        }
        return
      }

      const image = await loadImageFromFile(selectedFile)
      const processedDataUrl = selectedTool === 'passport'
        ? createPassportImage(image)
        : createBackgroundRemovedImage(image)

      setResultPreview(processedDataUrl)
      setNotice(`${activeTool.title} is ready.`)
    } catch (error) {
      setNotice(error instanceof Error ? `Could not process the image: ${error.message}` : 'Could not process the image.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleCopyText() {
    if (!extractedText) return
    try {
      await navigator.clipboard.writeText(extractedText)
      setNotice('Extracted text copied to clipboard.')
    } catch (error) {
      setNotice(error instanceof Error ? `Could not copy text: ${error.message}` : 'Could not copy text.')
    }
  }

  function handleDownload() {
    if (selectedTool === 'text-extractor' && extractedText) {
      const fileUrl = URL.createObjectURL(new Blob([extractedText], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = `extracted-text-${Date.now()}.txt`
      link.click()
      URL.revokeObjectURL(fileUrl)
      return
    }
    if (!resultPreview) return
    const link = document.createElement('a')
    link.href = resultPreview
    link.download = `${selectedTool === 'passport' ? 'passport-photo' : 'background-removed'}-${Date.now()}.png`
    link.click()
  }

  const hasDownloadableResult = selectedTool === 'text-extractor' ? Boolean(extractedText) : Boolean(resultPreview)

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
                onClick={() => {
                  setSelectedTool(tool.id)
                  setNotice('')
                }}
              >
                <div className="image-tool-icon" aria-hidden="true">
                  {tool.id === 'passport' ? '📸' : tool.id === 'background-remover' ? '✨' : '🔤'}
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
                Upload an image
              </label>
              <input id="image-tools-upload" type="file" accept="image/*" onChange={handleFileChange} />
              {selectedTool === 'text-extractor' && (
                <label className="image-tool-language">
                  OCR language
                  <select value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value)} disabled={isProcessing}>
                    {ocrLanguages.map((language) => (
                      <option key={language.code} value={language.code}>{language.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="image-tool-actions">
              <button type="button" className="image-tool-primary" onClick={handleProcessImage} disabled={!selectedFile || isProcessing}>
                {isProcessing ? (selectedTool === 'text-extractor' ? `Extracting… ${progress}%` : 'Processing…') : selectedTool === 'text-extractor' ? 'Extract text' : `Create ${activeTool.title.toLowerCase()}`}
              </button>
              {selectedTool === 'text-extractor' && (
                <button type="button" className="image-tool-secondary" onClick={handleCopyText} disabled={!extractedText || isProcessing}>
                  Copy text
                </button>
              )}
              <button type="button" className="image-tool-secondary" onClick={handleDownload} disabled={!hasDownloadableResult || isProcessing}>
                {selectedTool === 'text-extractor' ? 'Download .txt' : 'Download result'}
              </button>
            </div>

            {notice && <p className="image-tool-notice">{notice}</p>}

            <div className={selectedTool === 'text-extractor' ? 'image-tool-preview-grid image-tool-ocr-grid' : 'image-tool-preview-grid'}>
              <div className="image-preview-panel">
                <h3>Original</h3>
                {sourcePreview ? <img src={sourcePreview} alt="Original upload preview" /> : <div className="image-preview-empty">Upload an image to begin</div>}
              </div>

              {selectedTool === 'text-extractor' ? (
                <div className="image-preview-panel image-tool-text-result">
                  <h3>Extracted text</h3>
                  <textarea
                    aria-label="Extracted text"
                    placeholder="Extracted text will appear here"
                    value={extractedText}
                    onChange={(event) => setExtractedText(event.target.value)}
                    spellCheck="false"
                  />
                </div>
              ) : (
                <div className="image-preview-panel image-preview-transparent">
                  <h3>Result</h3>
                  {resultPreview ? <img src={resultPreview} alt="Processed output" /> : <div className="image-preview-empty">Your processed file will appear here</div>}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default ImageTools
