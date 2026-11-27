import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Eraser,
  Pause,
  PenTool,
  Play,
  SkipBack,
  SkipForward,
  Undo2,
  Upload,
} from 'lucide-react'
import {
  KERNELS,
  SAMPLE_GRIDS,
  applyConvolutionStep,
  applyFullConvolution,
  cloneGrid,
  createBlankGrid,
} from '../engine/convolution.js'
import { createCharRecognizer } from '../engine/charRecognizer.js'
import { playClick, playRecognize } from '../utils/sound.js'
import BookChapter, { BonusDrawer, BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './VisionLab.css'

const CORE_KERNELS = [
  { ...KERNELS.verticalEdge, shortTitle: 'Vertical Edge |' },
  { ...KERNELS.horizontalEdge, shortTitle: 'Horizontal Edge —' },
  { ...KERNELS.corner, shortTitle: 'Corner ⌜' },
]

const SAMPLE_LIST = [
  { id: 'smiley', label: '😀 Smiley', grid: SAMPLE_GRIDS.smiley.grid },
  { id: 'cross', label: '➕ Cross', grid: SAMPLE_GRIDS.cross.grid },
  { id: 'square', label: '⬜ Box', grid: SAMPLE_GRIDS.square.grid },
]

function formatNum(n) {
  if (Math.abs(n) < 0.005) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function getFilterVerdict(kernelId, value) {
  const absVal = Math.abs(value)
  const scoreStr = value > 0 ? `+${formatNum(value)}` : formatNum(value)
  if (absVal < 0.15) {
    return `No match here (score ${scoreStr}) — the pixels inside this 3×3 window don't match the filter's shape.`
  }
  if (kernelId === 'verticalEdge') {
    const side = value > 0 ? 'empty on the left, ink on the right' : 'ink on the left, empty on the right'
    return `Vertical edge spotted! (${side}, score ${scoreStr}).`
  }
  if (kernelId === 'horizontalEdge') {
    const side = value > 0 ? 'empty on top, ink below' : 'ink on top, empty below'
    return `Horizontal edge spotted! (${side}, score ${scoreStr}).`
  }
  return `Sharp corner spotted inside this 3×3 magnifying glass (score ${scoreStr})!`
}

/**
 * Demo 4A: 3x3 Convolution Edge Filter Scanner on 8x8 Pixel Art
 */
function PixelFilterDemo() {
  const [grid, setGrid] = useState(() => cloneGrid(SAMPLE_GRIDS.smiley.grid))
  const [kernelId, setKernelId] = useState('verticalEdge')
  const [scanIdx, setScanIdx] = useState(8)
  const [isScanning, setIsScanning] = useState(false)
  const paintValRef = useRef(null)

  const activeKernel = useMemo(
    () => CORE_KERNELS.find((k) => k.id === kernelId) || CORE_KERNELS[0],
    [kernelId],
  )
  const convResult = useMemo(() => applyFullConvolution(grid, activeKernel), [grid, activeKernel])
  const scanRow = Math.floor(scanIdx / 6)
  const scanCol = scanIdx % 6
  const activeStep = useMemo(
    () => applyConvolutionStep(grid, activeKernel.weights, scanRow, scanCol),
    [grid, activeKernel, scanRow, scanCol],
  )

  useEffect(() => {
    const stop = () => {
      paintValRef.current = null
    }
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])

  useEffect(() => {
    if (!isScanning) return undefined
    const timer = window.setInterval(() => {
      setScanIdx((i) => (i + 1) % 36)
    }, 320)
    return () => window.clearInterval(timer)
  }, [isScanning])

  const toggleCell = (r, c, forceVal = null) => {
    setGrid((prev) => {
      const next = cloneGrid(prev)
      next[r][c] = forceVal !== null ? forceVal : prev[r][c] ? 0 : 1
      return next
    })
  }

  return (
    <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Kernel selector + presets */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CORE_KERNELS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`btn btn-sm ${kernelId === k.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                playClick()
                setKernelId(k.id)
              }}
            >
              {k.shortTitle}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SAMPLE_LIST.map((s) => (
            <button
              key={s.id}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                playClick()
                setGrid(cloneGrid(s.grid))
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              playClick()
              setGrid(createBlankGrid(8))
            }}
          >
            <Eraser size={14} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 8x8 Pixel Grid + 6x6 Feature Map */}
      <div className="bp-grid" style={{ alignItems: 'start' }}>
        <div className="vision-panel">
          <div className="vision-panel-title">
            <span>1. Pixel Picture (8×8 — click to paint!)</span>
          </div>
          <div className="vision-pixel-grid-wrap">
            <div className="vision-pixel-grid" role="grid" aria-label="8 by 8 pixel art grid">
              {grid.map((rowArr, r) =>
                rowArr.map((val, c) => {
                  const inWindow = r >= scanRow && r < scanRow + 3 && c >= scanCol && c < scanCol + 3
                  return (
                    <button
                      key={`px-${r}-${c}`}
                      type="button"
                      aria-label={`Pixel ${r + 1},${c + 1} is ${val ? 'on' : 'off'}`}
                      className={`vision-pixel-cell ${val ? 'is-on' : ''} ${inWindow ? 'is-in-window' : ''}`}
                      onPointerDown={() => {
                        const nextVal = val ? 0 : 1
                        paintValRef.current = nextVal
                        toggleCell(r, c, nextVal)
                      }}
                      onPointerEnter={() => {
                        if (paintValRef.current !== null) toggleCell(r, c, paintValRef.current)
                      }}
                    />
                  )
                }),
              )}
            </div>
          </div>
        </div>

        <div className="vision-panel">
          <div className="vision-panel-title">
            <span>2. Glowing Feature Map (6×6)</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label="Previous window"
                onClick={() => setScanIdx((i) => (i + 35) % 36)}
              >
                <SkipBack size={13} />
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isScanning ? 'btn-success' : 'btn-primary'}`}
                onClick={() => setIsScanning((s) => !s)}
              >
                {isScanning ? <Pause size={13} /> : <Play size={13} />}
                <span>{isScanning ? 'Pause' : 'Scan'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label="Next window"
                onClick={() => setScanIdx((i) => (i + 1) % 36)}
              >
                <SkipForward size={13} />
              </button>
            </div>
          </div>

          <div className="vision-pixel-grid-wrap">
            <div
              className="vision-feature-grid"
              style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
              role="grid"
              aria-label="6 by 6 convolution feature map"
            >
              {convResult.featureMap.map((rowArr, r) =>
                rowArr.map((val, c) => {
                  const isSelected = r === scanRow && c === scanCol
                  const scale = convResult.maxAbs > 0 ? Math.min(1, Math.abs(val) / convResult.maxAbs) : 0
                  const bg =
                    Math.abs(val) < 0.01
                      ? '#1e293b'
                      : `rgba(16, 185, 129, ${(0.22 + scale * 0.78).toFixed(2)})`
                  return (
                    <button
                      key={`fm-${r}-${c}`}
                      type="button"
                      className={`vision-feature-cell ${isSelected ? 'is-selected' : ''}`}
                      style={{ backgroundColor: bg, color: scale > 0.45 ? '#ffffff' : '#cbd5e1' }}
                      onClick={() => {
                        setIsScanning(false)
                        setScanIdx(r * 6 + c)
                      }}
                    >
                      {formatNum(val)}
                    </button>
                  )
                }),
              )}
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Click any cell to slide the 3×3 magnifying glass there!
          </p>
        </div>
      </div>

      {/* Plain-English Verdict */}
      <div className="callout-kid" style={{ fontSize: '0.9rem' }}>
        <strong>Magnifying Glass Verdict (Row {scanRow + 1}, Col {scanCol + 1}):</strong>{' '}
        {getFilterVerdict(activeKernel.id, activeStep.value)}
      </div>

      <MathDrawer title="Peek at the Math: 3×3 Convolution Multiply & Add">
        <p>
          Each output cell multiplies the 9 pixels inside the 3×3 window by the 9 filter weights and adds them up:
        </p>
        <div className="formula-box">
          Patch × Kernel = [{activeStep.products.flat().map((p) => formatNum(p)).join(', ')}] → Sum ={' '}
          <strong>{formatNum(activeStep.value)}</strong>
        </div>
      </MathDrawer>
    </div>
  )
}

/**
 * Demo 4B: Draw a Digit (0-9) -> Pool (4x4) -> Live Feature Detectors -> Softmax Prediction
 */
function DigitRecognizerDemo() {
  const recognizerRef = useRef(null)
  const canvasRef = useRef(null)
  const strokesRef = useRef([])
  const activeStrokeRef = useRef(null)
  const [strokeCount, setStrokeCount] = useState(0)
  const [result, setResult] = useState(null)

  const getRecognizer = () => {
    if (!recognizerRef.current) {
      recognizerRef.current = createCharRecognizer('digits')
    }
    return recognizerRef.current
  }

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 18
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y)
      }
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 240
    canvas.height = 240
    redrawCanvas()
  }, [redrawCanvas])

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current.height,
    }
  }

  const runRecognition = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || strokesRef.current.length === 0) {
      setResult(null)
      return
    }
    const res = getRecognizer().recognizeFromCanvas(canvas)
    setResult(res)
    if (res) playRecognize()
  }, [])

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const pt = getPoint(e)
    const stroke = [pt]
    activeStrokeRef.current = stroke
    strokesRef.current = [...strokesRef.current, stroke]
    setStrokeCount(strokesRef.current.length)
    redrawCanvas()
  }

  const onPointerMove = (e) => {
    if (!activeStrokeRef.current) return
    activeStrokeRef.current.push(getPoint(e))
    redrawCanvas()
  }

  const onPointerUp = () => {
    if (!activeStrokeRef.current) return
    activeStrokeRef.current = null
    runRecognition()
  }

  const handleClear = () => {
    playClick()
    strokesRef.current = []
    activeStrokeRef.current = null
    setStrokeCount(0)
    setResult(null)
    redrawCanvas()
  }

  const handleUndo = () => {
    playClick()
    strokesRef.current = strokesRef.current.slice(0, -1)
    setStrokeCount(strokesRef.current.length)
    redrawCanvas()
    if (strokesRef.current.length === 0) setResult(null)
    else runRecognition()
  }

  const topActiveFeatures = useMemo(() => {
    if (!result?.networkTrace?.hiddenNodes) return []
    return [...result.networkTrace.hiddenNodes]
      .sort((a, b) => b.activation - a.activation)
      .slice(0, 4)
  }, [result])

  return (
    <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="vision-char-workspace">
        {/* Column 1: Draw */}
        <div className="vision-panel">
          <div className="vision-panel-title">
            <span>1. Draw a Digit (0–9)</span>
          </div>
          <div className="vision-draw-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="vision-draw-canvas"
              aria-label="Digit drawing pad"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {strokeCount === 0 && (
              <div className="vision-draw-hint">
                <PenTool size={20} color="#10b981" />
                <span>Draw a big bold 3, 7, or 8!</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={strokeCount === 0} onClick={handleUndo}>
              <Undo2 size={14} />
              <span>Undo</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={strokeCount === 0} onClick={handleClear}>
              <Eraser size={14} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Column 2: 4x4 Pooled Grid + Active Clues */}
        <div className="vision-panel">
          <div className="vision-panel-title">
            <span>2. Shrink (<TermTip id="pooling">Pooling</TermTip> → 4×4)</span>
          </div>
          <div className="vision-pooled-grid" style={{ maxWidth: 168, margin: '0 auto' }}>
            {(
              result?.networkTrace?.inputNodes ||
              Array.from({ length: 16 }, (_, id) => ({ id, activation: 0 }))
            ).map((node) => {
              const pct = Math.round(node.activation * 100)
              const bg =
                node.activation > 0.04
                  ? `rgba(16, 185, 129, ${(0.22 + node.activation * 0.78).toFixed(2)})`
                  : '#1e293b'
              return (
                <div
                  key={node.id}
                  className="vision-pooled-cell"
                  style={{ backgroundColor: bg, color: node.activation > 0.35 ? '#ffffff' : '#94a3b8' }}
                >
                  <span>{pct}%</span>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Pooling summarizes your drawing into 16 brightness numbers so the network focuses on shape, not tiny wobbles.
          </p>
          {topActiveFeatures.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {topActiveFeatures.map((f) => (
                <span key={f.label} className="badge badge-explorer" style={{ fontSize: '0.74rem' }}>
                  {f.shortLabel}: {Math.round(f.activation * 100)}%
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Prediction + Softmax Bars */}
        <div className="vision-panel">
          <div className="vision-panel-title">
            <span>3. AI Guess (<TermTip id="softmax">Softmax</TermTip>)</span>
          </div>
          {!result ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Draw any digit on the left — the network guesses automatically as soon as you lift your finger or mouse!
            </div>
          ) : (
            <>
              <div className="vision-char-prediction-hero" aria-live="polite">
                <div className="vision-char-big-glyph">{result.prediction}</div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Best Guess</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700 }}>
                    Looks like &ldquo;{result.prediction}&rdquo;
                  </div>
                  <span className="badge badge-success" style={{ marginTop: 4 }}>
                    {Math.round(result.confidence * 100)}% sure
                  </span>
                </div>
              </div>

              <div className="vision-topk-list">
                {result.topK.map((item, idx) => {
                  const pct = Math.round(item.prob * 100)
                  return (
                    <div key={item.char} className={`vision-topk-row ${idx === 0 ? 'is-top' : ''}`}>
                      <span className="vision-topk-glyph">{item.char}</span>
                      <div className="vision-conf-track">
                        <div
                          className="vision-conf-fill"
                          style={{ width: `${pct}%`, background: idx === 0 ? '#10b981' : '#64748b' }}
                        />
                      </div>
                      <span className="font-mono" style={{ textAlign: 'right' }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Optional Bonus: Live Camera / Photo Object Detector (Lazy-loaded TensorFlow.js COCO-SSD)
 */
function BonusCameraVision() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const modelRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const fileInputRef = useRef(null)

  const [status, setStatus] = useState('idle') // idle | loading | live | photo | error
  const [detections, setDetections] = useState([])
  const [message, setMessage] = useState('Start your webcam or upload any photo — runs 100% locally in your browser!')

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const loadModel = async () => {
    if (modelRef.current) return modelRef.current
    setStatus('loading')
    setMessage('Loading browser vision neural net (~5 MB, one-time)...')
    const tf = await import('@tensorflow/tfjs')
    await tf.ready()
    const cocoSsd = await import('@tensorflow-models/coco-ssd')
    modelRef.current = await cocoSsd.load()
    return modelRef.current
  }

  const drawBoxes = (ctx, preds, w, h, srcW, srcH) => {
    const sx = w / srcW
    const sy = h / srcH
    preds.forEach((d) => {
      const [bx, by, bw, bh] = d.bbox
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 3
      ctx.strokeRect(bx * sx, by * sy, bw * sx, bh * sy)
      const label = `${d.class} ${Math.round(d.score * 100)}%`
      ctx.font = 'bold 14px sans-serif'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = '#10b981'
      ctx.fillRect(bx * sx, Math.max(0, by * sy - 22), tw + 12, 22)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, bx * sx + 6, Math.max(15, by * sy - 6))
    })
  }

  const startCamera = async () => {
    try {
      stopCamera()
      const model = await loadModel()
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setStatus('live')
      setMessage('Live camera AI running locally — zero video leaves your device!')

      const loop = async () => {
        if (!streamRef.current || !videoRef.current || !canvasRef.current) return
        const v = videoRef.current
        if (v.readyState >= 2) {
          const c = canvasRef.current
          c.width = v.videoWidth || 480
          c.height = v.videoHeight || 360
          const ctx = c.getContext('2d')
          ctx.drawImage(v, 0, 0, c.width, c.height)
          const preds = await model.detect(v, 8, 0.45)
          setDetections(preds)
          drawBoxes(ctx, preds, c.width, c.height, v.videoWidth, v.videoHeight)
        }
        rafRef.current = window.requestAnimationFrame(loop)
      }
      loop()
    } catch {
      stopCamera()
      setStatus('error')
      setMessage('Camera unavailable or permission denied — try uploading any photo instead!')
    }
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    stopCamera()
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = async () => {
        try {
          const model = await loadModel()
          const c = canvasRef.current
          const scale = Math.min(1, 560 / img.width)
          c.width = Math.round(img.width * scale)
          c.height = Math.round(img.height * scale)
          const ctx = c.getContext('2d')
          ctx.drawImage(img, 0, 0, c.width, c.height)
          const preds = await model.detect(img, 10, 0.4)
          setDetections(preds)
          drawBoxes(ctx, preds, c.width, c.height, img.width, img.height)
          setStatus('photo')
          setMessage(preds.length > 0 ? `Found ${preds.length} object(s) in your photo!` : 'No everyday objects spotted — try another photo!')
        } catch {
          setStatus('error')
          setMessage('Could not load the vision model right now.')
        }
      }
      if (typeof reader.result === 'string') img.src = reader.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {status === 'live' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { stopCamera(); setStatus('idle') }}>
            <CameraOff size={15} />
            <span>Stop Camera</span>
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={startCamera} disabled={status === 'loading'}>
            <Camera size={15} />
            <span>Start Live Camera</span>
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={status === 'loading'}>
          <Upload size={15} />
          <span>Upload a Photo</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{message}</span>
      </div>

      <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 12,
          background: '#0f172a',
          display: status === 'live' || status === 'photo' ? 'block' : 'none',
        }}
      />

      {detections.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {detections.map((d, i) => (
            <span key={`${d.class}-${i}`} className="badge badge-success">
              {d.class} ({Math.round(d.score * 100)}%)
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VisionLab() {
  return (
    <BookChapter
      chapterId={4}
      recapFromPrev="In Chapter 3, hidden layers learned to curve around 2D patterns. Now let's see how neural networks understand pictures."
      cliffhangerTitle="Great with pictures — but what about WORDS?"
      cliffhangerText="Sliding 3×3 edge filters works wonders on grids of pixels. But a sentence isn't a picture — you can't find the 'vertical edge' of a word! Let's see how AI turns human language into numbers in Chapter 5."
    >
      {/* Beat 1: Pixels & 3x3 Edge Filters */}
      <BookSection num="1" title="A Photo Is Just a Grid of Numbers" id="ch4-filters">
        <p className="book-prose">
          To a computer, a photo isn’t a smiley face or a cat — it’s a giant checkerboard of
          brightness numbers called <strong>pixels</strong>. Instead of wiring every pixel to every
          neuron, vision networks (<TermTip id="cnn">CNNs</TermTip>) slide tiny 3×3 pattern-spotting
          magnifying glasses called <TermTip id="convolution">convolution filters</TermTip> across
          the image!
        </p>
        <p className="book-prose">
          Each filter hunts for ONE simple shape — like a vertical line, a horizontal line, or a
          corner. Wherever your pixel drawing matches the filter, the output map glows bright green:
        </p>

        <PixelFilterDemo />
      </BookSection>

      {/* Beat 2: Pooling & Reading Your Handwriting */}
      <BookSection num="2" title="From Edges to Whole Shapes: Read Your Handwriting" id="ch4-draw">
        <p className="book-prose">
          Stacking layers of filters lets a vision network combine tiny edges into curves, loops,
          and whole numbers! Draw any digit from <strong>0 to 9</strong> below and watch the
          pipeline in action: your drawing shrinks via <TermTip id="pooling">pooling</TermTip> into
          16 summary squares, lights up shape-detector neurons, and turns scores into clean
          percentages with <TermTip id="softmax">Softmax</TermTip>.
        </p>

        <DigitRecognizerDemo />
      </BookSection>

      {/* Optional Bonus: Real Browser Camera Vision */}
      <BonusDrawer
        title="Bonus: Test a Real Object-Detecting AI"
        subtitle="Try a pre-trained vision network on your webcam or any photo (100% private, on-device)"
      >
        <BonusCameraVision />
      </BonusDrawer>
    </BookChapter>
  )
}
