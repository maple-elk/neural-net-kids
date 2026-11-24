import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FastForward,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Workflow,
} from 'lucide-react'
import {
  evaluateLossLandscapeGrid,
  gradientStep,
  lossLandscape,
  lossLandscapeGradient,
  traceBackpropStep,
} from '../engine/mlp.js'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById } from '../utils/pathwayLoader.js'
import { playClick, playStep, playSuccess } from '../utils/sound.js'
import './BackpropLab.css'

const RANGE = 2
const INITIAL_POS = { w1: -1.15, w2: 1.05 }
const INITIAL_NET = {
  x: 1.0,
  target: 0.9,
  w1: -0.6,
  b1: 0.2,
  w2: 0.4,
  b2: -0.3,
}

function lossColor(t) {
  // t in [0, 1]: 0 = valley emerald/teal, 0.45 = warm yellow, 1 = high coral/red
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
  if (lr <= 0.14) {
    return { cls: 'is-slow', label: '🐢 Too Slow — tiny baby steps' }
  }
  if (lr <= 1.25) {
    return { cls: 'is-good', label: '🎯 Just Right — smooth downhill glide!' }
  }
  return { cls: 'is-fast', label: '🦘 Overshooting! Bouncing across the valley!' }
}

function LossHistorySparkline({ history }) {
  const w = 360
  const h = 92
  const pad = 12
  const maxVal = Math.max(0.5, ...history.map((p) => p.loss))

  const pts = history
    .map((p, i) => {
      const x =
        history.length === 1
          ? pad
          : pad + (i / (history.length - 1)) * (w - pad * 2)
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
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#cbd5e1" strokeDasharray="3 3" />
      <path d={pts} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
      <text x={pad} y={16} fontSize="10" fontWeight="700" fill="#64748b">
        Loss Elevation ({history.length - 1} steps)
      </text>
      <text x={w - pad} y={16} textAnchor="end" fontSize="10" fontFamily="monospace" fontWeight="700" fill="#0f172a">
        now: {last.loss.toFixed(3)}
      </text>
    </svg>
  )
}

function LossMountainPanel({ isDeepDive }) {
  const canvasRef = useRef(null)
  const [pos, setPos] = useState(INITIAL_POS)
  const [lr, setLr] = useState(0.45)
  const [trail, setTrail] = useState(() => [
    { w1: INITIAL_POS.w1, w2: INITIAL_POS.w2, loss: lossLandscape(INITIAL_POS.w1, INITIAL_POS.w2) },
  ])
  const [isAuto, setIsAuto] = useState(false)

  const grid = useMemo(() => evaluateLossLandscapeGrid(72, RANGE), [])

  // Draw contour heatmap once on canvas
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
        // Subtle contour bands
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
    const timer = window.setInterval(() => {
      takeStep()
    }, 240)
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

  // Next step arrow preview
  const preview = gradientStep(pos.w1, pos.w2, lr)
  const arrowX = toSvgX(Math.max(-RANGE, Math.min(RANGE, preview.w1)))
  const arrowY = toSvgY(Math.max(-RANGE, Math.min(RANGE, preview.w2)))

  const trailPoints = trail.map((p) => `${toSvgX(p.w1).toFixed(1)},${toSvgY(p.w2).toFixed(1)}`).join(' ')

  return (
    <div className="bp-grid">
      <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.22rem' }}>⛰️ Loss Mountain (Gradient Descent)</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Click anywhere on the map to drop the hiker! Green is the low-error valley; red is the high-error mountain peak.
          </p>
        </div>

        <div
          className="mountain-stage"
          onClick={handleCanvasClick}
          role="button"
          tabIndex={0}
          aria-label="Loss Mountain 2D contour map. Click to place hiker."
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              takeStep()
            }
          }}
        >
          <canvas ref={canvasRef} className="mountain-canvas" />
          <svg className="mountain-overlay" viewBox="0 0 300 300">
            {/* Trail polyline */}
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

            {/* Next step preview vector */}
            <line
              x1={hikerX}
              y1={hikerY}
              x2={arrowX}
              y2={arrowY}
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="4 3"
            />

            {/* Global minimum flag */}
            <g transform={`translate(${valleyX}, ${valleyY})`}>
              <circle r="11" fill="#ffffff" fillOpacity="0.9" stroke="#059669" strokeWidth="2" />
              <text x="0" y="4" textAnchor="middle" fontSize="11">
                🏁
              </text>
            </g>

            {/* Hiker / Ball */}
            <g transform={`translate(${hikerX}, ${hikerY})`}>
              <circle r="11" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5" />
              <circle r="4" fill="#38bdf8" />
            </g>

            {/* Axis labels */}
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
      </section>

      <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Controls &amp; Learning Rate</h3>
          <span className={`lr-status-pill ${lrFeedback.cls}`}>{lrFeedback.label}</span>
        </div>

        <div className="clue-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700 }}>
            <span>Learning Rate (η)</span>
            <span className="font-mono" style={{ color: '#dc2626' }}>
              {lr.toFixed(2)}
            </span>
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
              🐢 Too Slow (0.06)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLr(0.45)}>
              🎯 Just Right (0.45)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLr(2.2)}>
              🦘 Overshoot (2.20)
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="button" className="btn btn-primary" onClick={takeStep}>
            <StepForward size={16} />
            <span>Take 1 Step</span>
          </button>
          <button
            type="button"
            className={`btn ${isAuto ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setIsAuto((a) => !a)}
          >
            {isAuto ? <Pause size={16} /> : <Play size={16} />}
            <span>{isAuto ? 'Pause Descent' : 'Auto-Descend'}</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleReset}>
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>

        <div className="bp-stat-grid">
          <div className="bp-stat">
            <div className="bp-stat-label">Current Loss</div>
            <div className="bp-stat-val" style={{ color: currentLoss < 0.05 ? '#059669' : '#dc2626' }}>
              {currentLoss.toFixed(4)}
            </div>
          </div>
          <div className="bp-stat">
            <div className="bp-stat-label">Position (w₁, w₂)</div>
            <div className="bp-stat-val" style={{ fontSize: '0.88rem' }}>
              ({pos.w1.toFixed(2)}, {pos.w2.toFixed(2)})
            </div>
          </div>
          <div className="bp-stat">
            <div className="bp-stat-label">Steps Taken</div>
            <div className="bp-stat-val">{trail.length - 1}</div>
          </div>
        </div>

        {isDeepDive ? (
          <div className="formula-box">
            <div>∇L(w₁, w₂) = ({grad.dw1.toFixed(3)}, {grad.dw2.toFixed(3)})</div>
            <div style={{ marginTop: 4, color: '#38bdf8' }}>
              w_new = w − η · ∇L = ({preview.w1.toFixed(3)}, {preview.w2.toFixed(3)})
            </div>
          </div>
        ) : (
          <div className="callout-kid" style={{ fontSize: '0.88rem' }}>
            <strong>Try this:</strong> Switch to <strong>Overshoot (2.20)</strong> and press{' '}
            <em>Auto-Descend</em>! Notice how giant steps leap right over the green valley instead of landing inside it.
          </div>
        )}
      </section>
    </div>
  )
}

function BackpropTimeMachinePanel({ isDeepDive }) {
  const [params, setParams] = useState(INITIAL_NET)
  const [lr, setLr] = useState(1.2)
  const [activeStep, setActiveStep] = useState(1)
  const [round, setRound] = useState(1)

  const trace = useMemo(
    () =>
      traceBackpropStep(
        params.x,
        params.target,
        params.w1,
        params.b1,
        params.w2,
        params.b2,
        lr,
      ),
    [params, lr],
  )

  const applySingleUpdate = () => {
    playStep()
    setParams((prev) => ({
      ...prev,
      ...trace.updatedWeights,
    }))
    setRound((r) => r + 1)
    setActiveStep(1)
  }

  const runFiveRounds = () => {
    playStep()
    setParams((prev) => {
      let curr = { ...prev }
      for (let i = 0; i < 5; i += 1) {
        const res = traceBackpropStep(curr.x, curr.target, curr.w1, curr.b1, curr.w2, curr.b2, lr)
        curr = { ...curr, ...res.updatedWeights }
      }
      return curr
    })
    setRound((r) => r + 5)
    setActiveStep(4)
  }

  const resetNet = () => {
    setParams(INITIAL_NET)
    setRound(1)
    setActiveStep(1)
  }

  const isForwardAnim = activeStep === 1
  const isBackwardAnim = activeStep === 3

  const stepMeta = [
    { num: 1, title: 'Forward Pass', sub: 'Guess left → right', backward: false },
    { num: 2, title: 'Measure Mistake', sub: 'Compare vs target', backward: false },
    { num: 3, title: 'Blame Game', sub: 'Gradients right → left', backward: true },
    { num: 4, title: 'Nudge Weights', sub: 'Shrink the error!', backward: false },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="tm-steps-bar" role="tablist" aria-label="Backpropagation 4-step trace">
        {stepMeta.map((s) => (
          <button
            key={s.num}
            type="button"
            role="tab"
            aria-selected={activeStep === s.num}
            className={`tm-step-btn ${s.backward ? 'is-backward' : ''} ${activeStep === s.num ? 'is-active' : ''}`}
            onClick={() => setActiveStep(s.num)}
          >
            <span className="tm-step-num">Step {s.num}</span>
            <span className="tm-step-title">{s.title}</span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.sub}</span>
          </button>
        ))}
      </div>

      <div className="bp-grid">
        <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: '1.2rem' }}>⏱️ Backprop Time-Machine (Round {round})</h2>
            <span className="badge badge-subtle font-mono">
              Target = {params.target.toFixed(2)} · Loss = {trace.forward.loss.toFixed(4)}
            </span>
          </div>

          <div className="tm-svg-wrap">
            <svg viewBox="0 0 560 220" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Mini 2-layer neural network backpropagation diagram">
              {/* Forward / Backward edge 1: x -> h */}
              <line
                x1="96"
                y1="100"
                x2="236"
                y2="100"
                stroke={isBackwardAnim ? '#ef4444' : isForwardAnim ? '#0ea5e9' : '#64748b'}
                strokeWidth={isForwardAnim || isBackwardAnim ? 5 : 3}
                strokeLinecap="round"
                className={
                  isForwardAnim
                    ? 'tm-pulse-forward'
                    : isBackwardAnim
                      ? 'tm-pulse-backward'
                      : undefined
                }
              />
              {/* Edge 1 weight label */}
              <g transform="translate(166, 70)">
                <rect x="-42" y="-13" width="84" height="26" rx="13" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                <text x="0" y="4" textAnchor="middle" fontSize="11.5" fontWeight="700" fontFamily="monospace" fill="#0f172a">
                  w₁={params.w1.toFixed(2)}
                </text>
              </g>
              {isBackwardAnim && (
                <text x="166" y="126" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="monospace" fill="#dc2626">
                  ∂L/∂w₁={trace.gradients.dL_dw1.toFixed(3)}
                </text>
              )}

              {/* Forward / Backward edge 2: h -> y */}
              <line
                x1="316"
                y1="100"
                x2="436"
                y2="100"
                stroke={isBackwardAnim ? '#ef4444' : isForwardAnim ? '#0ea5e9' : '#64748b'}
                strokeWidth={isForwardAnim || isBackwardAnim ? 5 : 3}
                strokeLinecap="round"
                className={
                  isForwardAnim
                    ? 'tm-pulse-forward'
                    : isBackwardAnim
                      ? 'tm-pulse-backward'
                      : undefined
                }
              />
              {/* Edge 2 weight label */}
              <g transform="translate(376, 70)">
                <rect x="-42" y="-13" width="84" height="26" rx="13" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                <text x="0" y="4" textAnchor="middle" fontSize="11.5" fontWeight="700" fontFamily="monospace" fill="#0f172a">
                  w₂={params.w2.toFixed(2)}
                </text>
              </g>
              {isBackwardAnim && (
                <text x="376" y="126" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="monospace" fill="#dc2626">
                  ∂L/∂w₂={trace.gradients.dL_dw2.toFixed(3)}
                </text>
              )}

              {/* Input node */}
              <g transform="translate(60, 100)">
                <circle r="36" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2.5" />
                <text x="0" y="-6" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369a1">
                  Input x
                </text>
                <text x="0" y="13" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill="#0f172a">
                  {params.x.toFixed(1)}
                </text>
              </g>

              {/* Hidden node */}
              <g transform="translate(276, 100)">
                <circle
                  r="40"
                  fill={isBackwardAnim ? '#fef2f2' : '#eef2ff'}
                  stroke={isBackwardAnim ? '#ef4444' : '#6366f1'}
                  strokeWidth="3"
                />
                <text x="0" y="-10" textAnchor="middle" fontSize="11" fontWeight="700" fill="#4338ca">
                  Hidden h
                </text>
                <text x="0" y="9" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill="#0f172a">
                  {trace.forward.h.toFixed(3)}
                </text>
                <text x="0" y="25" textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="#64748b">
                  b₁={params.b1.toFixed(2)}
                </text>
              </g>

              {/* Output node */}
              <g transform="translate(478, 100)">
                <circle
                  r="42"
                  fill={activeStep === 2 ? '#fef3c7' : '#ecfdf5'}
                  stroke={activeStep === 2 ? '#f59e0b' : '#10b981'}
                  strokeWidth="3"
                />
                <text x="0" y="-10" textAnchor="middle" fontSize="11" fontWeight="700" fill="#065f46">
                  Guess y
                </text>
                <text x="0" y="9" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill="#0f172a">
                  {trace.forward.output.toFixed(3)}
                </text>
                <text x="0" y="25" textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="#64748b">
                  b₂={params.b2.toFixed(2)}
                </text>
              </g>

              {/* Direction legend banner */}
              <rect x="130" y="172" width="300" height="30" rx="15" fill={isBackwardAnim ? '#fee2e2' : '#e0f2fe'} />
              <text
                x="280"
                y="191"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={isBackwardAnim ? '#b91c1c' : '#0369a1'}
              >
                {activeStep === 1 && '→ Blue signal flows FORWARD to make a guess'}
                {activeStep === 2 && `Mistake = y − target = ${trace.forward.error.toFixed(3)}`}
                {activeStep === 3 && '← Coral blame flows BACKWARD to each weight'}
                {activeStep === 4 && `Loss drops: ${trace.forward.loss.toFixed(4)} → ${trace.nextLoss.toFixed(4)}`}
              </text>
            </svg>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={activeStep === 1}
                onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
              >
                ← Prev Step
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={activeStep === 4}
                onClick={() => setActiveStep((s) => Math.min(4, s + 1))}
              >
                Next Step →
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={applySingleUpdate}>
                <StepForward size={15} />
                <span>Apply Nudge (1 Round)</span>
              </button>
              <button type="button" className="btn btn-success btn-sm" onClick={runFiveRounds}>
                <FastForward size={15} />
                <span>Train +5 Rounds</span>
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetNet}>
                <RotateCcw size={15} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </section>

        <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: '1.1rem' }}>
            Step {activeStep}: {stepMeta[activeStep - 1].title}
          </h3>

          {activeStep === 1 && (
            <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
              {isDeepDive ? (
                <>
                  Forward pass computes hidden activation <code>h = σ(w₁·x + b₁) = {trace.forward.h.toFixed(4)}</code>{' '}
                  and output prediction <code>y = σ(w₂·h + b₂) = {trace.forward.output.toFixed(4)}</code>.
                </>
              ) : (
                <>
                  The input <strong>{params.x}</strong> travels forward through the hidden neuron (
                  <strong>{trace.forward.h.toFixed(2)}</strong>) to produce a guess of{' '}
                  <strong>{trace.forward.output.toFixed(3)}</strong>.
                </>
              )}
            </div>
          )}

          {activeStep === 2 && (
            <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
              {isDeepDive ? (
                <>
                  Residual error <code>e = y − target = {trace.forward.error.toFixed(4)}</code>. Squared error loss{' '}
                  <code>L = ½e² = {trace.forward.loss.toFixed(5)}</code>.
                </>
              ) : (
                <>
                  We wanted <strong>{params.target.toFixed(2)}</strong>, but the network guessed{' '}
                  <strong>{trace.forward.output.toFixed(3)}</strong>! Our Mistake Score (Loss) is{' '}
                  <strong>{trace.forward.loss.toFixed(4)}</strong>.
                </>
              )}
            </div>
          )}

          {activeStep === 3 && (
            <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
              {isDeepDive ? (
                <>
                  Chain rule propagates gradients backward: <code>δ₂ = (y−t)·y(1−y) = {trace.gradients.delta2.toFixed(4)}</code>,{' '}
                  <code>∂L/∂w₂ = δ₂·h = {trace.gradients.dL_dw2.toFixed(4)}</code>,{' '}
                  <code>∂L/∂w₁ = δ₁·x = {trace.gradients.dL_dw1.toFixed(4)}</code>.
                </>
              ) : (
                <>
                  The error message travels <strong>backward</strong> from the output! Each weight learns whether
                  increasing it would make the mistake bigger (+) or smaller (−).
                </>
              )}
            </div>
          )}

          {activeStep === 4 && (
            <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
              {isDeepDive ? (
                <>
                  Updating <code>θ ← θ − η∇L</code> (η = {lr.toFixed(1)}) reduces loss from{' '}
                  <code>{trace.forward.loss.toFixed(5)}</code> to <code>{trace.nextLoss.toFixed(5)}</code> (Δ ={' '}
                  <code>{trace.lossDelta.toFixed(5)}</code>).
                </>
              ) : (
                <>
                  We gently nudge each weight in the opposite direction of its blame! Watch the Loss shrink from{' '}
                  <strong>{trace.forward.loss.toFixed(4)}</strong> down to{' '}
                  <strong>{trace.nextLoss.toFixed(4)}</strong>!
                </>
              )}
            </div>
          )}

          <div className="weight-diff-grid">
            <div className="weight-diff-card">
              <div>w₁: {params.w1.toFixed(3)} → <strong>{trace.updatedWeights.w1.toFixed(3)}</strong></div>
              <div style={{ color: '#64748b', fontSize: '0.76rem' }}>grad: {trace.gradients.dL_dw1.toFixed(4)}</div>
            </div>
            <div className="weight-diff-card">
              <div>b₁: {params.b1.toFixed(3)} → <strong>{trace.updatedWeights.b1.toFixed(3)}</strong></div>
              <div style={{ color: '#64748b', fontSize: '0.76rem' }}>grad: {trace.gradients.dL_db1.toFixed(4)}</div>
            </div>
            <div className="weight-diff-card">
              <div>w₂: {params.w2.toFixed(3)} → <strong>{trace.updatedWeights.w2.toFixed(3)}</strong></div>
              <div style={{ color: '#64748b', fontSize: '0.76rem' }}>grad: {trace.gradients.dL_dw2.toFixed(4)}</div>
            </div>
            <div className="weight-diff-card">
              <div>b₂: {params.b2.toFixed(3)} → <strong>{trace.updatedWeights.b2.toFixed(3)}</strong></div>
              <div style={{ color: '#64748b', fontSize: '0.76rem' }}>grad: {trace.gradients.dL_db2.toFixed(4)}</div>
            </div>
          </div>

          <div className="clue-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700 }}>
              <span>Step Size (Learning Rate η)</span>
              <span className="font-mono">{lr.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.2"
              value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
              aria-label="Backprop learning rate"
              style={{ width: '100%', accentColor: '#ef4444' }}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export default function BackpropLab() {
  const { isDeepDive, completedStages, markStageComplete, navigate } = useLearning()
  const stage = getStageById(3)
  const [tab, setTab] = useState('mountain')
  const isDone = completedStages.has(3)

  return (
    <div className="lab-page">
      <header className="lab-header" style={{ '--stage-accent': stage?.color || '#ef4444' }}>
        <div>
          <div className="stage-card-badges">
            <span
              className="badge"
              style={{ background: '#ef44441a', color: '#b91c1c', border: '1px solid #ef444455' }}
            >
              Stage 3 · {stage?.level || 'Explorer'}
            </span>
            <span className="badge badge-subtle">{stage?.ageBadge || 'Ages 10+'}</span>
            {isDone && (
              <span className="badge badge-success">
                <CheckCircle2 size={13} />
                Completed
              </span>
            )}
          </div>
          <h1>{stage?.title || 'Learning from Mistakes'}</h1>
          <p className="stage-card-subtitle">
            {stage?.subtitle || 'Roll down Loss Mountain and trace backpropagation step by step.'}
          </p>
        </div>

        <div className="bp-tabs" role="tablist" aria-label="Backprop lab sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mountain'}
            className={`bp-tab-btn ${tab === 'mountain' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('mountain')
              playClick()
            }}
          >
            <Mountain size={16} />
            <span>A: Loss Mountain</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'timemachine'}
            className={`bp-tab-btn ${tab === 'timemachine' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('timemachine')
              playClick()
            }}
          >
            <Workflow size={16} />
            <span>B: Backprop Time-Machine</span>
          </button>
        </div>
      </header>

      <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
        {isDeepDive ? (
          <>
            <strong>Optimization &amp; Chain Rule:</strong> Neural networks minimize a differentiable loss
            function by computing exact partial derivatives via backpropagation and taking gradient descent steps{' '}
            <code>θ ← θ − η∇L(θ)</code>.
          </>
        ) : (
          <>
            <strong>How AI learns:</strong> First, the network makes a guess and sees how wrong it was (Loss).
            Then it walks downhill on <strong>Loss Mountain</strong> by sending a backward &ldquo;blame signal&rdquo; to
            nudge every weight!
          </>
        )}
      </div>

      {tab === 'mountain' ? (
        <LossMountainPanel isDeepDive={isDeepDive} />
      ) : (
        <BackpropTimeMachinePanel isDeepDive={isDeepDive} />
      )}

      <nav className="lab-footer-nav" aria-label="Stage 3 navigation">
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/stage/2')}>
          <ArrowLeft size={16} />
          <span>Prev: Stage 2</span>
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => {
              markStageComplete(3)
              playSuccess()
            }}
          >
            <CheckCircle2 size={16} />
            <span>{isDone ? 'Stage 3 Completed' : 'Mark Stage 3 Complete'}</span>
          </button>

          <button type="button" className="btn btn-primary" onClick={() => navigate('/stage/4')}>
            <span>Next: Stage 4 →</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>
    </div>
  )
}
