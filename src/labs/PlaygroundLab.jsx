import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FastForward,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  StepForward,
} from 'lucide-react'
import {
  createMLP,
  evaluateGrid,
  generateDataset,
  traceBackpropStep,
} from '../engine/mlp.js'
import { playClick, playStep, playSuccess } from '../utils/sound.js'
import BookChapter, { BonusDrawer, BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './PlaygroundLab.css'
import './BackpropLab.css'

const CANVAS_SIZE = 280
const GRID_RES = 34
const INITIAL_BP_NET = {
  x: 1.0,
  target: 0.9,
  w1: -0.6,
  b1: 0.2,
  w2: 0.4,
  b2: -0.3,
}

function drawDecisionCanvas(canvas, offscreenRef, net, points, probe = null) {
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

  // Center crosshairs
  ctx.save()
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)'
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(CANVAS_SIZE / 2, 0)
  ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE)
  ctx.moveTo(0, CANVAS_SIZE / 2)
  ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2)
  ctx.stroke()
  ctx.restore()

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
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

  if (probe) {
    const px = ((probe.x + 1) / 2) * CANVAS_SIZE
    const py = ((1 - probe.y) / 2) * CANVAS_SIZE
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fill()
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 2.2
    ctx.stroke()
  }
}

function MiniNetworkSvg({ snapshot, activations }) {
  const width = 460
  const height = 220
  const { layerSizes, layers } = snapshot
  const numCols = layerSizes.length
  const marginX = 52
  const topY = 34
  const bottomY = height - 26

  const cols = layerSizes.map((count, colIdx) => {
    const x = numCols === 1 ? width / 2 : marginX + (colIdx / (numCols - 1)) * (width - marginX * 2)
    const usableH = bottomY - topY
    const stepY = count > 1 ? Math.min(40, usableH / (count - 1)) : 0
    const startY = topY + (usableH - stepY * (count - 1)) / 2
    return {
      x,
      nodes: Array.from({ length: count }, (_, idx) => ({ x, y: startY + idx * stepY })),
    }
  })

  return (
    <svg className="pg-network-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Live neural network diagram">
      {cols.map((col, colIdx) => (
        <text key={colIdx} x={col.x} y={16} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">
          {colIdx === 0 ? 'Inputs' : colIdx === numCols - 1 ? 'Output' : `Hidden ${colIdx}`}
        </text>
      ))}
      {layers.map((layer, l) =>
        layer.weights.map((row, j) =>
          row.map((w, i) => (
            <line
              key={`${l}-${i}-${j}`}
              x1={cols[l].nodes[i].x}
              y1={cols[l].nodes[i].y}
              x2={cols[l + 1].nodes[j].x}
              y2={cols[l + 1].nodes[j].y}
              stroke={w >= 0 ? '#0ea5e9' : '#f43f5e'}
              strokeWidth={Math.min(4.5, 0.8 + Math.abs(w) * 1.1)}
              strokeOpacity={Math.min(0.92, 0.2 + Math.abs(w) * 0.28)}
              strokeLinecap="round"
            />
          )),
        ),
      )}
      {cols.map((col, colIdx) => {
        const isInput = colIdx === 0
        const isOutput = colIdx === numCols - 1
        const acts = activations?.[colIdx] || []
        return col.nodes.map((node, idx) => {
          const val = acts[idx] ?? 0
          const centered = isOutput ? (val - 0.5) * 2 : Math.max(-1, Math.min(1, val))
          const fill = centered > 0.15 ? '#e0f2fe' : centered < -0.15 ? '#ffe4e6' : '#f8fafc'
          const stroke = centered > 0.15 ? '#0284c7' : centered < -0.15 ? '#e11d48' : '#94a3b8'
          return (
            <g key={`n-${colIdx}-${idx}`}>
              <circle cx={node.x} cy={node.y} r={13} fill={fill} stroke={stroke} strokeWidth="2.2" />
              <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)" fill="#0f172a">
                {isInput ? (idx === 0 ? 'x' : 'y') : isOutput ? 'ŷ' : idx + 1}
              </text>
            </g>
          )
        })
      })}
    </svg>
  )
}

/**
 * Embedded XOR comparison demo:
 * Lets the reader experience 0 hidden layers failing on XOR, then click ONE button
 * to add 4 hidden helper neurons and watch the boundary bend around all 4 corners!
 */
function XorBreakthroughDemo() {
  const dataset = useMemo(() => generateDataset('xor', 120, 42), [])
  const [hasHidden, setHasHidden] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [probe, setProbe] = useState({ x: 0.45, y: 0.45 })

  const createFresh = useCallback((withHidden, seed = 42) => {
    const net = createMLP({
      inputSize: 2,
      hiddenSizes: withHidden ? [4] : [],
      outputSize: 1,
      activation: 'tanh',
      learningRate: withHidden ? 0.55 : 0.4,
      seed,
    })
    const ev = net.evaluate(dataset)
    return { net, loss: ev.loss, accuracy: ev.accuracy, snapshot: net.getSnapshot(), trace: net.forward([0.45, 0.45]) }
  }, [dataset])

  const initial = useMemo(() => createFresh(false, 42), [createFresh])
  const [loss, setLoss] = useState(initial.loss)
  const [accuracy, setAccuracy] = useState(initial.accuracy)
  const [snapshot, setSnapshot] = useState(initial.snapshot)
  const [trace, setTrace] = useState(initial.trace)

  const canvasRef = useRef(null)
  const offscreenRef = useRef(null)
  const mlpRef = useRef(initial.net)
  const probeRef = useRef(probe)
  const rafRef = useRef(null)
  const solvedSoundRef = useRef(false)
  const stuckPausedRef = useRef(false)

  useEffect(() => {
    probeRef.current = probe
    drawDecisionCanvas(canvasRef.current, offscreenRef, mlpRef.current, dataset, probe)
  }, [dataset, probe])

  const switchArchitecture = (withHidden) => {
    playClick()
    setIsPlaying(false)
    solvedSoundRef.current = false
    stuckPausedRef.current = false
    setHasHidden(withHidden)
    const fresh = createFresh(withHidden, 42)
    mlpRef.current = fresh.net
    setEpoch(0)
    setLoss(fresh.loss)
    setAccuracy(fresh.accuracy)
    setSnapshot(fresh.snapshot)
    setTrace(fresh.trace)
    drawDecisionCanvas(canvasRef.current, offscreenRef, fresh.net, dataset, probeRef.current)
  }

  const runSteps = useCallback(
    (count) => {
      const net = mlpRef.current
      let res = null
      for (let i = 0; i < count; i++) res = net.trainStep(dataset)
      if (!res) return
      const curProbe = probeRef.current
      setEpoch(res.epoch)
      setLoss(res.loss)
      setAccuracy(res.accuracy)
      setSnapshot(net.getSnapshot())
      setTrace(net.forward([curProbe.x, curProbe.y]))
      drawDecisionCanvas(canvasRef.current, offscreenRef, net, dataset, curProbe)
      if (!hasHidden && res.epoch >= 60 && !stuckPausedRef.current) {
        stuckPausedRef.current = true
        setIsPlaying(false)
      }
      if (hasHidden && res.loss < 0.045 && !solvedSoundRef.current) {
        solvedSoundRef.current = true
        playSuccess()
        setIsPlaying(false)
      }
    },
    [dataset, hasHidden],
  )

  useEffect(() => {
    if (!isPlaying) return undefined
    let active = true
    const stepsPerFrame = hasHidden ? 4 : 2
    const tick = () => {
      if (!active) return
      runSteps(stepsPerFrame)
      rafRef.current = window.requestAnimationFrame(tick)
    }
    rafRef.current = window.requestAnimationFrame(tick)
    return () => {
      active = false
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, hasHidden, runSteps])

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
    const y = Math.max(-1, Math.min(1, 1 - ((e.clientY - rect.top) / rect.height) * 2))
    const pt = { x, y }
    setProbe(pt)
    setTrace(mlpRef.current.forward([x, y]))
  }

  const isStuck = !hasHidden && epoch >= 24
  const isSolved = hasHidden && epoch > 0 && loss < 0.05

  return (
    <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${!hasHidden ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchArchitecture(false)}
          >
            1 Neuron (0 Hidden Layers)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${hasHidden ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchArchitecture(true)}
          >
            Team of 4 Hidden Neurons ✨
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${isPlaying ? 'btn-success' : 'btn-primary'}`}
            onClick={() => {
              playClick()
              setIsPlaying((p) => !p)
            }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause' : 'Train'}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => switchArchitecture(hasHidden)}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Narrator */}
      <div className={`pg-narrator ${isStuck ? 'is-stuck' : isSolved ? 'is-solved' : isPlaying ? 'is-training' : 'is-idle'}`}>
        <div className="pg-narrator-left">
          <span className="pg-narrator-badge">
            {isStuck ? 'Stuck!' : isSolved ? 'Cracked XOR!' : isPlaying ? 'Training' : 'Ready'}
          </span>
          <div className="pg-narrator-copy">
            <span>
              {isStuck
                ? `After ${epoch} rounds, accuracy is trapped near ${Math.round(accuracy * 100)}%! One straight fence can never put opposite corners on the same side.`
                : isSolved
                  ? `Boom! The 4 hidden helper neurons teamed up to bend the boundary around all 4 corners (${Math.round(accuracy * 100)}% accuracy)!`
                  : hasHidden
                    ? 'Press Train to watch the 4 helper neurons bend the map around the XOR checkerboard.'
                    : 'Press Train with 1 neuron first — see if a single straight fence can separate opposite corners!'}
            </span>
          </div>
        </div>
        {isStuck && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => switchArchitecture(true)}
          >
            Add 4 Hidden Neurons →
          </button>
        )}
      </div>

      <div className="bp-grid" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onMouseMove={handleMouseMove}
            style={{
              width: '100%',
              maxWidth: 280,
              aspectRatio: '1 / 1',
              borderRadius: 14,
              border: '2px solid var(--border-subtle)',
              cursor: 'crosshair',
            }}
          />
          <div className="bp-stat-grid" style={{ width: '100%', maxWidth: 280 }}>
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
              <div className="bp-stat-val">{Math.round(accuracy * 100)}%</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MiniNetworkSvg snapshot={snapshot} activations={trace.activations} />
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Hover over the 2D map to see which neurons light up! Blue lines = positive votes, coral = negative votes.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Demo 3B: Backpropagation Time-Machine (4-step plain-English trace)
 */
function BackpropTimeMachine() {
  const [params, setParams] = useState(INITIAL_BP_NET)
  const [activeStep, setActiveStep] = useState(1)
  const [round, setRound] = useState(1)
  const lr = 1.2

  const trace = useMemo(
    () => traceBackpropStep(params.x, params.target, params.w1, params.b1, params.w2, params.b2, lr),
    [params],
  )

  const applySingleUpdate = () => {
    playStep()
    setParams((prev) => ({ ...prev, ...trace.updatedWeights }))
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
    playClick()
    setParams(INITIAL_BP_NET)
    setRound(1)
    setActiveStep(1)
  }

  const isForward = activeStep === 1
  const isBackward = activeStep === 3
  const stepMeta = [
    { num: 1, title: 'Forward Guess', sub: 'Left → Right' },
    { num: 2, title: 'Measure Mistake', sub: 'Compare vs Goal' },
    { num: 3, title: 'Blame Game', sub: 'Right → Left', backward: true },
    { num: 4, title: 'Nudge Weights', sub: 'Shrink Error!' },
  ]

  return (
    <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tm-steps-bar" role="tablist" aria-label="Backpropagation 4-step trace">
        {stepMeta.map((s) => (
          <button
            key={s.num}
            type="button"
            role="tab"
            aria-selected={activeStep === s.num}
            className={`tm-step-btn ${s.backward ? 'is-backward' : ''} ${activeStep === s.num ? 'is-active' : ''}`}
            onClick={() => {
              playClick()
              setActiveStep(s.num)
            }}
          >
            <span className="tm-step-num">Step {s.num}</span>
            <span className="tm-step-title">{s.title}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.sub}</span>
          </button>
        ))}
      </div>

      <div className="tm-svg-wrap">
        <svg viewBox="0 0 560 210" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Backpropagation signal flow">
          <line
            x1="96" y1="95" x2="236" y2="95"
            stroke={isBackward ? '#ef4444' : isForward ? '#0ea5e9' : '#64748b'}
            strokeWidth={isForward || isBackward ? 5 : 3}
            strokeLinecap="round"
            className={isForward ? 'tm-pulse-forward' : isBackward ? 'tm-pulse-backward' : undefined}
          />
          <g transform="translate(166, 65)">
            <rect x="-42" y="-13" width="84" height="26" rx="13" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <text x="0" y="4" textAnchor="middle" fontSize="11.5" fontWeight="700" fontFamily="monospace" fill="#0f172a">
              w₁={params.w1.toFixed(2)}
            </text>
          </g>

          <line
            x1="316" y1="95" x2="436" y2="95"
            stroke={isBackward ? '#ef4444' : isForward ? '#0ea5e9' : '#64748b'}
            strokeWidth={isForward || isBackward ? 5 : 3}
            strokeLinecap="round"
            className={isForward ? 'tm-pulse-forward' : isBackward ? 'tm-pulse-backward' : undefined}
          />
          <g transform="translate(376, 65)">
            <rect x="-42" y="-13" width="84" height="26" rx="13" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <text x="0" y="4" textAnchor="middle" fontSize="11.5" fontWeight="700" fontFamily="monospace" fill="#0f172a">
              w₂={params.w2.toFixed(2)}
            </text>
          </g>

          <g transform="translate(60, 95)">
            <circle r="34" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2.5" />
            <text x="0" y="-5" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0369a1">Input</text>
            <text x="0" y="13" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill="#0f172a">{params.x.toFixed(1)}</text>
          </g>

          <g transform="translate(276, 95)">
            <circle r="38" fill={isBackward ? '#fef2f2' : '#eef2ff'} stroke={isBackward ? '#ef4444' : '#6366f1'} strokeWidth="3" />
            <text x="0" y="-6" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#4338ca">Hidden</text>
            <text x="0" y="13" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill="#0f172a">{trace.forward.h.toFixed(2)}</text>
          </g>

          <g transform="translate(478, 95)">
            <circle r="40" fill={activeStep === 2 ? '#fef3c7' : '#ecfdf5'} stroke={activeStep === 2 ? '#f59e0b' : '#10b981'} strokeWidth="3" />
            <text x="0" y="-6" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#065f46">Guess</text>
            <text x="0" y="13" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill="#0f172a">{trace.forward.output.toFixed(2)}</text>
          </g>

          <rect x="115" y="162" width="330" height="30" rx="15" fill={isBackward ? '#fee2e2' : '#e0f2fe'} />
          <text x="280" y="181" textAnchor="middle" fontSize="12" fontWeight="700" fill={isBackward ? '#b91c1c' : '#0369a1'}>
            {activeStep === 1 && '→ Blue signal flows FORWARD to make a guess'}
            {activeStep === 2 && `Goal = ${params.target.toFixed(2)}, Guess = ${trace.forward.output.toFixed(2)} (Loss = ${trace.forward.loss.toFixed(3)})`}
            {activeStep === 3 && '← Red blame note flows BACKWARD to every weight'}
            {activeStep === 4 && `Weights nudged! Loss drops: ${trace.forward.loss.toFixed(3)} → ${trace.nextLoss.toFixed(3)}`}
          </text>
        </svg>
      </div>

      <div className="callout-kid" style={{ fontSize: '0.92rem' }}>
        {activeStep === 1 && <><strong>Step 1 (Forward Pass):</strong> The input <strong>{params.x}</strong> travels left-to-right through the hidden neuron to make a guess of <strong>{trace.forward.output.toFixed(3)}</strong>.</>}
        {activeStep === 2 && <><strong>Step 2 (Measure Mistake):</strong> We wanted <strong>{params.target.toFixed(2)}</strong>, so our Mistake Score (Loss) is <strong>{trace.forward.loss.toFixed(4)}</strong>.</>}
        {activeStep === 3 && <><strong>Step 3 (Pass Blame Backward):</strong> The error message travels <strong>right-to-left</strong> so even hidden weight <code>w₁</code> knows whether to nudge up or down!</>}
        {activeStep === 4 && <><strong>Step 4 (Nudge Weights):</strong> Both weights take a tiny downhill step, shrinking Loss from <strong>{trace.forward.loss.toFixed(4)}</strong> down to <strong>{trace.nextLoss.toFixed(4)}</strong> (Round {round})!</>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={activeStep === 1} onClick={() => setActiveStep((s) => Math.max(1, s - 1))}>
            ← Prev Step
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={activeStep === 4} onClick={() => setActiveStep((s) => Math.min(4, s + 1))}>
            Next Step →
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={applySingleUpdate}>
            <StepForward size={15} />
            <span>Apply 1 Round</span>
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

      <MathDrawer title="Peek at the Math: The Chain Rule in Backpropagation">
        <p>
          Backpropagation applies the calculus <strong>chain rule</strong> layer by layer from output back to input:
        </p>
        <div className="formula-box">
          <div>δ₂ = (ŷ − target)·ŷ(1 − ŷ) = {trace.gradients.delta2.toFixed(4)}</div>
          <div>∂L/∂w₂ = δ₂ · h = {trace.gradients.dL_dw2.toFixed(4)} &nbsp;→&nbsp; w₂: {params.w2.toFixed(3)} → {trace.updatedWeights.w2.toFixed(3)}</div>
          <div>∂L/∂w₁ = δ₁ · x = {trace.gradients.dL_dw1.toFixed(4)} &nbsp;→&nbsp; w₁: {params.w1.toFixed(3)} → {trace.updatedWeights.w1.toFixed(3)}</div>
        </div>
      </MathDrawer>
    </div>
  )
}

/**
 * Optional Bonus Free Sandbox (tucked inside BonusDrawer at the bottom of Ch 3)
 */
function FreePlaygroundSandbox() {
  const [datasetType, setDatasetType] = useState('circle')
  const [hiddenSizes, setHiddenSizes] = useState([4])
  const [activation, setActivation] = useState('tanh')
  const [lr, setLr] = useState(0.6)
  const [isPlaying, setIsPlaying] = useState(false)
  const [epoch, setEpoch] = useState(0)

  const dataset = useMemo(() => generateDataset(datasetType, 120, 42), [datasetType])
  const initNet = useMemo(
    () => createMLP({ inputSize: 2, hiddenSizes: [4], outputSize: 1, activation: 'tanh', learningRate: 0.6, seed: 42 }),
    [],
  )
  const [loss, setLoss] = useState(() => initNet.evaluate(generateDataset('circle', 120, 42)).loss)
  const [accuracy, setAccuracy] = useState(() => initNet.evaluate(generateDataset('circle', 120, 42)).accuracy)
  const [snapshot, setSnapshot] = useState(() => initNet.getSnapshot())

  const canvasRef = useRef(null)
  const offscreenRef = useRef(null)
  const mlpRef = useRef(initNet)
  const rafRef = useRef(null)

  const rebuild = useCallback((dsType, hSizes, act, nextLr) => {
    setIsPlaying(false)
    const ds = generateDataset(dsType, 120, 42)
    const net = createMLP({ inputSize: 2, hiddenSizes: hSizes, outputSize: 1, activation: act, learningRate: nextLr, seed: 42 })
    mlpRef.current = net
    const ev = net.evaluate(ds)
    setEpoch(0)
    setLoss(ev.loss)
    setAccuracy(ev.accuracy)
    setSnapshot(net.getSnapshot())
    drawDecisionCanvas(canvasRef.current, offscreenRef, net, ds)
  }, [])

  useEffect(() => {
    drawDecisionCanvas(canvasRef.current, offscreenRef, mlpRef.current, dataset)
  }, [dataset])

  useEffect(() => {
    if (!isPlaying) return undefined
    let active = true
    const tick = () => {
      if (!active) return
      const net = mlpRef.current
      let res = null
      for (let i = 0; i < 5; i++) res = net.trainStep(dataset)
      if (res) {
        setEpoch(res.epoch)
        setLoss(res.loss)
        setAccuracy(res.accuracy)
        setSnapshot(net.getSnapshot())
        drawDecisionCanvas(canvasRef.current, offscreenRef, net, dataset)
      }
      rafRef.current = window.requestAnimationFrame(tick)
    }
    rafRef.current = window.requestAnimationFrame(tick)
    return () => {
      active = false
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, dataset])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['linear', 'circle', 'xor', 'spiral'].map((ds) => (
            <button
              key={ds}
              type="button"
              className={`btn btn-sm ${datasetType === ds ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setDatasetType(ds)
                const nextH = ds === 'spiral' ? [8, 8] : ds === 'linear' ? [] : [4]
                setHiddenSizes(nextH)
                rebuild(ds, nextH, activation, lr)
              }}
            >
              {ds.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`btn btn-sm ${isPlaying ? 'btn-success' : 'btn-primary'}`} onClick={() => setIsPlaying((p) => !p)}>
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Train'}</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => rebuild(datasetType, hiddenSizes, activation, lr)}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Hidden Layers:</span>
        <button
          type="button"
          className="pg-icon-btn"
          disabled={hiddenSizes.length <= 0}
          onClick={() => {
            const next = hiddenSizes.slice(0, -1)
            setHiddenSizes(next)
            rebuild(datasetType, next, activation, lr)
          }}
        >
          <Minus size={14} />
        </button>
        <strong className="font-mono">{hiddenSizes.length}</strong>
        <button
          type="button"
          className="pg-icon-btn"
          disabled={hiddenSizes.length >= 3}
          onClick={() => {
            const next = [...hiddenSizes, 4]
            setHiddenSizes(next)
            rebuild(datasetType, next, activation, lr)
          }}
        >
          <Plus size={14} />
        </button>

        {hiddenSizes.map((cnt, idx) => (
          <div key={idx} className="pg-hidden-chip">
            <span>H{idx + 1}:</span>
            <button
              type="button"
              className="pg-mini-step"
              disabled={cnt <= 1}
              onClick={() => {
                const next = hiddenSizes.map((v, i) => (i === idx ? v - 1 : v))
                setHiddenSizes(next)
                rebuild(datasetType, next, activation, lr)
              }}
            >
              −
            </button>
            <span className="font-mono">{cnt}</span>
            <button
              type="button"
              className="pg-mini-step"
              disabled={cnt >= 8}
              onClick={() => {
                const next = hiddenSizes.map((v, i) => (i === idx ? v + 1 : v))
                setHiddenSizes(next)
                rebuild(datasetType, next, activation, lr)
              }}
            >
              +
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {['tanh', 'relu', 'sigmoid'].map((act) => (
            <button
              key={act}
              type="button"
              className={`btn btn-sm ${activation === act ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setActivation(act)
                rebuild(datasetType, hiddenSizes, act, lr)
              }}
            >
              {act}
            </button>
          ))}
        </div>
      </div>

      <div className="bp-grid" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ width: '100%', maxWidth: 260, aspectRatio: '1 / 1', borderRadius: 12, border: '1px solid var(--border-subtle)' }}
          />
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Epoch {epoch} · Loss {loss.toFixed(3)} · Accuracy {Math.round(accuracy * 100)}%
          </div>
        </div>
        <MiniNetworkSvg snapshot={snapshot} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', fontWeight: 700 }}>
        <span>Learning Rate: {lr.toFixed(2)}</span>
        <input
          type="range"
          min="0.05"
          max="1.5"
          step="0.05"
          value={lr}
          onChange={(e) => {
            const v = Number(e.target.value)
            setLr(v)
            mlpRef.current.learningRate = v
          }}
        />
      </label>
    </div>
  )
}

export default function PlaygroundLab() {
  return (
    <BookChapter
      chapterId={3}
      recapFromPrev="In Chapter 2, one neuron learned to draw a straight fence by sliding down Loss Mountain."
      cliffhangerTitle="Great with dots — but what about real pictures?"
      cliffhangerText="Hidden layers and backpropagation can bend around circles, checkerboards, and spirals. But a photo isn't 2 coordinates — it's thousands of tiny pixels! Let's see how computers spot shapes and read handwriting in Chapter 4."
    >
      {/* Beat 1: The XOR Trap + Hidden Layer Breakthrough */}
      <BookSection num="1" title="The 1969 XOR Trap — And How Hidden Layers Escape It" id="ch3-xor">
        <p className="book-prose">
          Look at the checkerboard below (called <TermTip id="xor">XOR</TermTip>): opposite corners
          belong to the same team! Try pressing <strong>Train</strong> with 1 neuron first. Because
          one neuron can only draw <strong>one straight fence</strong>, it gets stuck near 50%!
        </p>
        <p className="book-prose">
          Now switch to <strong>Team of 4 Hidden Neurons</strong>. Each helper in the{' '}
          <TermTip id="hidden-layer">hidden layer</TermTip> draws its own simple fence, and the
          final neuron combines their votes to curve around all four corners!
        </p>

        <XorBreakthroughDemo />
      </BookSection>

      {/* Beat 2: Backpropagation Time-Machine */}
      <BookSection num="2" title="How Do Hidden Neurons Know How to Change?" id="ch3-backprop">
        <p className="book-prose">
          There’s one mystery left: only the <em>final</em> output neuron sees the right answer.
          So how do the middle helper neurons know which way to nudge their weights?
        </p>
        <p className="book-prose">
          The 1986 breakthrough called <TermTip id="backprop">Backpropagation</TermTip> passes a
          &ldquo;blame note&rdquo; <strong>backward</strong> from the output to every hidden weight.
          Step through one full learning round below:
        </p>

        <BackpropTimeMachine />
      </BookSection>

      {/* Optional Free Playground */}
      <BonusDrawer
        title="Bonus: Free Neural Network Sandbox"
        subtitle="Try Circles, Spirals, multiple hidden layers, ReLU/Sigmoid, and Learning Rate"
      >
        <FreePlaygroundSandbox />
      </BonusDrawer>
    </BookChapter>
  )
}
