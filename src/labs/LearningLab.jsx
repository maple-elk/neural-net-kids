import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import {
  createMLP,
  evaluateGrid,
  evaluateLossLandscapeGrid,
  generateDataset,
  gradientStep,
  lossLandscape,
  lossLandscapeGradient,
} from '../engine/mlp.js'
import { playClick, playStep, playSuccess } from '../utils/sound.js'
import BookChapter, { BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './BackpropLab.css'

const RANGE = 2
const INITIAL_POS = { w1: -1.15, w2: 1.05 }

function lossColor(t) {
  const clamped = Math.max(0, Math.min(1, t))
  let r
  let g
  let b
  if (clamped < 0.45) {
    const u = clamped / 0.45
    r = Math.round(16 + u * (250 - 16))
    g = Math.round(185 + u * (204 - 185))
    b = Math.round(129 + u * (21 - 129))
  } else {
    const u = (clamped - 0.45) / 0.55
    r = Math.round(250 + u * (220 - 250))
    g = Math.round(204 + u * (38 - 204))
    b = Math.round(21 + u * (38 - 21))
  }
  return [r, g, b]
}

function getLrFeedback(lr) {
  if (lr <= 0.14) return { cls: 'is-slow', label: '🐢 Too Slow — tiny baby steps' }
  if (lr <= 1.25) return { cls: 'is-good', label: '🎯 Just Right — smooth downhill glide!' }
  return { cls: 'is-fast', label: '🦘 Overshooting! Leaping right past the valley!' }
}

function LossHistorySparkline({ history }) {
  const w = 360
  const h = 84
  const pad = 12
  const maxVal = Math.max(0.5, ...history.map((p) => p.loss))
  const pts = history
    .map((p, i) => {
      const x = history.length === 1 ? pad : pad + (i / (history.length - 1)) * (w - pad * 2)
      const y = h - pad - (p.loss / maxVal) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const last = history[history.length - 1]
  const lastX = history.length === 1 ? pad : w - pad
  const lastY = h - pad - (last.loss / maxVal) * (h - pad * 2)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Loss over steps">
      <rect x="0" y="0" width={w} height={h} rx="10" fill="#f8fafc" stroke="#e2e8f0" />
      <path d={pts} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
      <text x={pad} y={16} fontSize="10" fontWeight="700" fill="#64748b">
        Mistake Height ({history.length - 1} steps)
      </text>
      <text x={w - pad} y={16} textAnchor="end" fontSize="10" fontFamily="monospace" fontWeight="700" fill="#0f172a">
        loss: {last.loss.toFixed(3)}
      </text>
    </svg>
  )
}

/**
 * Demo 2B: Single self-learning neuron on a 2D map (Linear dataset).
 * Bridges Chapter 1 (weights) + Demo 2A (Loss Mountain) -> Chapter 3 (XOR & hidden layers).
 */
function SingleNeuronMapDemo() {
  const CANVAS_SIZE = 280
  const GRID_RES = 32
  const dataset = useMemo(() => generateDataset('linear', 100, 42), [])

  const initialBundle = useMemo(() => {
    const net = createMLP({
      inputSize: 2,
      hiddenSizes: [],
      outputSize: 1,
      activation: 'tanh',
      learningRate: 0.75,
      seed: 19,
    })
    const ev = net.evaluate(dataset)
    return { net, loss: ev.loss, accuracy: ev.accuracy }
  }, [dataset])

  const [isPlaying, setIsPlaying] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [loss, setLoss] = useState(initialBundle.loss)
  const [accuracy, setAccuracy] = useState(initialBundle.accuracy)
  const [seed, setSeed] = useState(19)

  const canvasRef = useRef(null)
  const offscreenRef = useRef(null)
  const mlpRef = useRef(initialBundle.net)
  const rafRef = useRef(null)
  const celebratedRef = useRef(false)

  const drawCanvas = useCallback(
    (net) => {
      const canvas = canvasRef.current
      if (!canvas || !net) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (!offscreenRef.current) {
        const off = document.createElement('canvas')
        off.width = GRID_RES
        off.height = GRID_RES
        offscreenRef.current = off
      }
      const offCtx = offscreenRef.current.getContext('2d')
      const { values } = evaluateGrid(net, GRID_RES)
      const imgData = offCtx.createImageData(GRID_RES, GRID_RES)
      const data = imgData.data

      for (let r = 0; r < GRID_RES; r++) {
        for (let c = 0; c < GRID_RES; c++) {
          const p = values[r][c]
          const idx = (r * GRID_RES + c) * 4
          if (p >= 0.5) {
            const t = Math.min(1, (p - 0.5) * 2)
            data[idx] = Math.round(255 - t * (255 - 56))
            data[idx + 1] = Math.round(255 - t * (255 - 189))
            data[idx + 2] = Math.round(255 - t * (255 - 248))
          } else {
            const t = Math.min(1, (0.5 - p) * 2)
            data[idx] = Math.round(255 - t * (255 - 251))
            data[idx + 1] = Math.round(255 - t * (255 - 146))
            data[idx + 2] = Math.round(255 - t * (255 - 60))
          }
          data[idx + 3] = 255
        }
      }
      offCtx.putImageData(imgData, 0, 0)
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(offscreenRef.current, 0, 0, CANVAS_SIZE, CANVAS_SIZE)

      for (let i = 0; i < dataset.length; i++) {
        const pt = dataset[i]
        const cx = ((pt.x + 1) / 2) * CANVAS_SIZE
        const cy = ((1 - pt.y) / 2) * CANVAS_SIZE
        ctx.beginPath()
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = pt.label === 1 ? '#0284c7' : '#ea580c'
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    },
    [dataset],
  )

  useEffect(() => {
    drawCanvas(mlpRef.current)
  }, [drawCanvas])

  const stepEpochs = useCallback(
    (count) => {
      const net = mlpRef.current
      let res = null
      for (let i = 0; i < count; i++) {
        res = net.trainStep(dataset)
      }
      if (res) {
        setEpoch(res.epoch)
        setLoss(res.loss)
        setAccuracy(res.accuracy)
        drawCanvas(net)
        if (res.loss < 0.04 && !celebratedRef.current) {
          celebratedRef.current = true
          playSuccess()
          setIsPlaying(false)
        }
      }
    },
    [dataset, drawCanvas],
  )

  useEffect(() => {
    if (!isPlaying) return undefined
    let active = true
    const tick = () => {
      if (!active) return
      stepEpochs(3)
      rafRef.current = window.requestAnimationFrame(tick)
    }
    rafRef.current = window.requestAnimationFrame(tick)
    return () => {
      active = false
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, stepEpochs])

  const handleReset = () => {
    playClick()
    setIsPlaying(false)
    celebratedRef.current = false
    const nextSeed = seed + 13
    setSeed(nextSeed)
    const net = createMLP({
      inputSize: 2,
      hiddenSizes: [],
      outputSize: 1,
      activation: 'tanh',
      learningRate: 0.75,
      seed: nextSeed,
    })
    mlpRef.current = net
    const ev = net.evaluate(dataset)
    setEpoch(0)
    setLoss(ev.loss)
    setAccuracy(ev.accuracy)
    drawCanvas(net)
  }

  const isSolved = epoch > 0 && loss < 0.05

  return (
    <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: '1.15rem' }}>📏 Watch One Neuron Teach Itself</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Press <strong>Train</strong>! The neuron starts with random weights and slides down Loss Mountain until its straight fence separates Team Teal from Team Coral.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${isPlaying ? 'btn-success' : 'btn-primary'}`}
            onClick={() => {
              playClick()
              setIsPlaying((p) => !p)
            }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause' : 'Train Neuron'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              playStep()
              stepEpochs(5)
            }}
          >
            <StepForward size={15} />
            <span>+5 Rounds</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="bp-grid" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{
              width: '100%',
              maxWidth: 280,
              aspectRatio: '1 / 1',
              borderRadius: 14,
              border: '2px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span>🔵 Teal Dot = Team A</span>
            <span>🟠 Coral Dot = Team B</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="bp-stat-grid">
            <div className="bp-stat">
              <div className="bp-stat-label">Rounds</div>
              <div className="bp-stat-val">{epoch}</div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-label">Loss</div>
              <div className="bp-stat-val" style={{ color: loss < 0.05 ? '#059669' : '#dc2626' }}>
                {loss.toFixed(3)}
              </div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-label">Accuracy</div>
              <div className="bp-stat-val" style={{ color: accuracy >= 0.95 ? '#059669' : '#0f172a' }}>
                {Math.round(accuracy * 100)}%
              </div>
            </div>
          </div>

          <div className={isSolved ? 'book-takeaway' : 'callout-deep'} style={{ fontSize: '0.9rem' }}>
            {isSolved ? (
              <>
                <strong>Solved in {epoch} rounds!</strong> Notice that the border between blue and orange is a{' '}
                <strong>single straight fence</strong> — because one neuron only has two weight dials (one for left-right <code>x</code>, one for up-down <code>y</code>).
              </>
            ) : (
              <>
                <strong>What’s happening?</strong> Every round (an <TermTip id="epoch">epoch</TermTip>), the neuron checks all 100 dots, measures its total mistake (Loss), and nudges its weights downhill!
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LearningLab() {
  const canvasRef = useRef(null)
  const [pos, setPos] = useState(INITIAL_POS)
  const [lr, setLr] = useState(0.45)
  const [trail, setTrail] = useState(() => [
    { w1: INITIAL_POS.w1, w2: INITIAL_POS.w2, loss: lossLandscape(INITIAL_POS.w1, INITIAL_POS.w2) },
  ])
  const [isAuto, setIsAuto] = useState(false)

  const grid = useMemo(() => evaluateLossLandscapeGrid(72, RANGE), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const res = grid.resolution
    canvas.width = res
    canvas.height = res
    const imgData = ctx.createImageData(res, res)

    for (let r = 0; r < res; r += 1) {
      for (let c = 0; c < res; c += 1) {
        const val = grid.values[r][c]
        const norm = (val - grid.min) / Math.max(0.0001, grid.max - grid.min)
        const [cr, cg, cb] = lossColor(Math.pow(norm, 0.72))
        const contourMod = Math.abs(((val * 4.5) % 1) - 0.5) < 0.045 ? 0.86 : 1
        const idx = (r * res + c) * 4
        imgData.data[idx] = Math.round(cr * contourMod)
        imgData.data[idx + 1] = Math.round(cg * contourMod)
        imgData.data[idx + 2] = Math.round(cb * contourMod)
        imgData.data[idx + 3] = 255
      }
    }
    ctx.putImageData(imgData, 0, 0)
  }, [grid])

  const takeStep = useCallback(() => {
    playStep()
    setPos((prev) => {
      const res = gradientStep(prev.w1, prev.w2, lr)
      const clampedW1 = Math.max(-RANGE, Math.min(RANGE, res.w1))
      const clampedW2 = Math.max(-RANGE, Math.min(RANGE, res.w2))
      const clampedLoss = lossLandscape(clampedW1, clampedW2)
      setTrail((t) => [...t.slice(-60), { w1: clampedW1, w2: clampedW2, loss: clampedLoss }])
      return { w1: clampedW1, w2: clampedW2 }
    })
  }, [lr])

  useEffect(() => {
    if (!isAuto) return undefined
    const timer = window.setInterval(() => takeStep(), 240)
    return () => window.clearInterval(timer)
  }, [isAuto, takeStep])

  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    const w1 = -RANGE + nx * 2 * RANGE
    const w2 = RANGE - ny * 2 * RANGE
    setIsAuto(false)
    setPos({ w1, w2 })
    setTrail([{ w1, w2, loss: lossLandscape(w1, w2) }])
  }

  const handleReset = () => {
    playClick()
    setIsAuto(false)
    setPos(INITIAL_POS)
    setTrail([
      { w1: INITIAL_POS.w1, w2: INITIAL_POS.w2, loss: lossLandscape(INITIAL_POS.w1, INITIAL_POS.w2) },
    ])
  }

  const currentLoss = lossLandscape(pos.w1, pos.w2)
  const grad = lossLandscapeGradient(pos.w1, pos.w2)
  const lrFeedback = getLrFeedback(lr)
  const toSvgX = (w1) => ((w1 + RANGE) / (2 * RANGE)) * 300
  const toSvgY = (w2) => ((RANGE - w2) / (2 * RANGE)) * 300
  const hikerX = toSvgX(pos.w1)
  const hikerY = toSvgY(pos.w2)
  const valleyX = toSvgX(0.8)
  const valleyY = toSvgY(-0.6)
  const preview = gradientStep(pos.w1, pos.w2, lr)
  const arrowX = toSvgX(Math.max(-RANGE, Math.min(RANGE, preview.w1)))
  const arrowY = toSvgY(Math.max(-RANGE, Math.min(RANGE, preview.w2)))
  const trailPoints = trail.map((p) => `${toSvgX(p.w1).toFixed(1)},${toSvgY(p.w2).toFixed(1)}`).join(' ')

  return (
    <BookChapter
      chapterId={2}
      recapFromPrev="In Chapter 1, you adjusted a neuron’s weights by hand. Now let’s teach the neuron to adjust its own weights."
      cliffhangerTitle="Wait — what if a straight fence isn’t enough?"
      cliffhangerText="One neuron easily drew a straight line between two clean groups of dots. But in 1969, scientists showed a simple checkerboard puzzle (XOR) where NO straight line can ever win! Let's see how teaming up neurons into hidden layers solves it in Chapter 3."
    >
      {/* Beat 1: Loss Mountain */}
      <BookSection num="1" title="Turn Mistakes into a Mountain" id="ch2-mountain">
        <p className="book-prose">
          How does an AI know which way to turn its weight dials? First, it measures how wrong its
          guess was — a mistake score called <TermTip id="loss">Loss</TermTip>.
        </p>
        <p className="book-prose">
          Imagine every possible setting of two weights <code>(w₁, w₂)</code> as a spot on a hilly
          map. High red peaks mean huge mistakes; the low green valley (🏁) means the right answer!
          To learn, the neuron feels which way the ground slopes downhill and takes a step — a trick
          called <TermTip id="gradient-descent">Gradient Descent</TermTip>.
        </p>

        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="bp-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                className="mountain-stage"
                onClick={handleCanvasClick}
                role="button"
                tabIndex={0}
                aria-label="Loss Mountain 2D contour map. Click to drop the hiker."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    takeStep()
                  }
                }}
              >
                <canvas ref={canvasRef} className="mountain-canvas" />
                <svg className="mountain-overlay" viewBox="0 0 300 300">
                  {trail.length > 1 && (
                    <polyline
                      points={trailPoints}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2.5"
                      strokeOpacity="0.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  <line
                    x1={hikerX}
                    y1={hikerY}
                    x2={arrowX}
                    y2={arrowY}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />
                  <g transform={`translate(${valleyX}, ${valleyY})`}>
                    <circle r="11" fill="#ffffff" fillOpacity="0.9" stroke="#059669" strokeWidth="2" />
                    <text x="0" y="4" textAnchor="middle" fontSize="11">🏁</text>
                  </g>
                  <g transform={`translate(${hikerX}, ${hikerY})`}>
                    <circle r="11" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5" />
                    <circle r="4" fill="#38bdf8" />
                  </g>
                  <text x="150" y="292" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">
                    Weight w₁ →
                  </text>
                  <text
                    x="12"
                    y="150"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#0f172a"
                    transform="rotate(-90 12 150)"
                  >
                    Weight w₂ →
                  </text>
                </svg>
              </div>
              <LossHistorySparkline history={trail} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h3 style={{ fontSize: '1.08rem', marginBottom: 6 }}>Choose Your Stride Size</h3>
                <span className={`lr-status-pill ${lrFeedback.cls}`}>{lrFeedback.label}</span>
              </div>

              <div className="clue-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700 }}>
                  <span><TermTip id="learning-rate">Learning Rate</TermTip> (Stride Size)</span>
                  <span className="font-mono" style={{ color: '#dc2626' }}>{lr.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.03"
                  max="2.6"
                  step="0.01"
                  value={lr}
                  onChange={(e) => setLr(parseFloat(e.target.value))}
                  aria-label="Learning rate slider"
                  style={{ width: '100%', accentColor: '#ef4444' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLr(0.06)}>
                    🐢 Too Slow
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLr(0.45)}>
                    🎯 Just Right
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLr(2.2)}>
                    🦘 Overshoot
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={takeStep}>
                  <StepForward size={15} />
                  <span>Take 1 Step</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${isAuto ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => setIsAuto((a) => !a)}
                >
                  {isAuto ? <Pause size={15} /> : <Play size={15} />}
                  <span>{isAuto ? 'Pause' : 'Auto-Descend'}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
              </div>

              <div className="callout-kid" style={{ fontSize: '0.88rem' }}>
                <strong>Experiment:</strong> Click anywhere on the map to drop the hiker. Try{' '}
                <strong>Overshoot</strong> + <em>Auto-Descend</em> to see why giant steps bounce right past the valley!
              </div>
            </div>
          </div>

          <MathDrawer title="Peek at the Math: Gradient Descent Update">
            <p>
              The gradient <code>∇L</code> points uphill. Moving in the opposite direction shrinks the loss:
            </p>
            <div className="formula-box">
              <div>∇L(w₁, w₂) = ({grad.dw1.toFixed(3)}, {grad.dw2.toFixed(3)})</div>
              <div style={{ marginTop: 4, color: '#38bdf8' }}>
                w_new = w − η · ∇L = ({preview.w1.toFixed(3)}, {preview.w2.toFixed(3)}) &nbsp;(current Loss = {currentLoss.toFixed(4)})
              </div>
            </div>
          </MathDrawer>
        </div>
      </BookSection>

      {/* Beat 2: From Clues to a 2D Map */}
      <BookSection num="2" title="From Clues to a 2D Map" id="ch2-map">
        <p className="book-prose">
          In Chapter 1, our clues were simple ON/OFF switches like <em>Sunny Sky</em>. Now imagine
          giving a neuron two number clues — <strong>x</strong> (how far right a dot is) and{' '}
          <strong>y</strong> (how high up it is). Every dot on the square below is just a pair of
          clues!
        </p>
        <p className="book-prose">
          The shaded background shows what the neuron guesses at every spot: blue for{' '}
          <strong>Team Teal</strong>, orange for <strong>Team Coral</strong>, and white right along
          its <TermTip id="decision-boundary">decision boundary</TermTip>. Watch what happens when
          this single neuron slides down Loss Mountain on its own:
        </p>

        <SingleNeuronMapDemo />
      </BookSection>
    </BookChapter>
  )
}
