import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  StepForward,
  Trophy,
} from 'lucide-react'
import TermTip from '../components/TermTip.jsx'
import { useLearning } from '../context/LearningContext.jsx'
import { getGlossaryEntry } from '../data/glossary.js'
import { createMLP, evaluateGrid, generateDataset } from '../engine/mlp.js'
import { getStageById, STAGES } from '../utils/pathwayLoader.js'
import { playClick, playSuccess } from '../utils/sound.js'
import './PlaygroundLab.css'

const DATASET_OPTIONS = [
  {
    id: 'linear',
    label: 'Linear',
    kidDesc:
      'Linear: Two teams split cleanly by a single straight line — easy even with 0 hidden layers!',
    deepDesc: 'Linearly separable half-spaces (x + y ≥ 0) — solvable by a single affine hyperplane.',
  },
  {
    id: 'circle',
    label: 'Circle',
    kidDesc:
      'Circle: An inner teal island surrounded by a coral ring — you need a hidden layer to bend a fence around it!',
    deepDesc: 'Concentric radial boundary (r < 0.5 vs r > 0.65) requiring a closed non-linear decision region.',
  },
  {
    id: 'xor',
    label: 'XOR',
    kidDesc:
      'XOR ("Exclusive OR"): Opposite corners share a team like a checkerboard — impossible for 1 straight line, so you need a hidden layer!',
    deepDesc: 'Classic non-linearly separable quadrant parity (x·y > 0) requiring ≥2 hidden units to fold space.',
  },
  {
    id: 'spiral',
    label: 'Spiral',
    kidDesc:
      'Spiral: Two galaxy arms twisted around each other — the hardest puzzle, needing 2–3 hidden layers to weave between them!',
    deepDesc: 'Intertwined 2-arm Archimedean spiral manifold requiring deeper compositional representations.',
  },
]

const ACTIVATION_INFO = {
  tanh: {
    label: 'Tanh',
    kid: 'Smoothly squishes any number into a range from −1 to +1, centered at zero — great all-rounder for curved shapes!',
    deep: 'tanh(z) ∈ (−1, 1), derivative 1 − tanh²(z). Zero-centered outputs speed convergence.',
  },
  relu: {
    label: 'ReLU',
    kid: 'Turns negative numbers into 0 and keeps positive numbers as-is — like a one-way gate that only passes positive signals!',
    deep: 'ReLU(z) = max(0, z), derivative 1 if z > 0 else 0. Creates piecewise-linear folds.',
  },
  sigmoid: {
    label: 'Sigmoid',
    kid: 'Smoothly squishes any number into a 0% to 100% probability (between 0 and 1)!',
    deep: 'σ(z) = 1 / (1 + e⁻ᶻ), derivative σ(z)(1 − σ(z)). Can saturate in deeper networks.',
  },
}

const MISSIONS = [
  {
    id: 'linear',
    title: 'Mission 1: Straight-Line Sorter',
    dataset: 'linear',
    kidDesc: 'Solve the Linear dataset using 0 or 1 hidden layer. Notice how even a single straight boundary separates it!',
    deepDesc: 'Reach MSE < 0.05 on Linear with 0 or 1 hidden layer (a single affine hyperplane suffices).',
    goalLabel: 'Linear · ≤1 hidden layer · Loss < 0.05',
    preset: { dataset: 'linear', hiddenSizes: [], activation: 'tanh', lr: 0.4 },
    check: ({ datasetType, hiddenSizes, loss }) =>
      datasetType === 'linear' && hiddenSizes.length <= 1 && loss < 0.05,
  },
  {
    id: 'xor',
    title: 'Mission 2: Break the XOR Barrier',
    dataset: 'xor',
    kidDesc: 'First try XOR with 1 hidden neuron — why does it get stuck? Now boost to 4 neurons and watch it bend!',
    deepDesc: 'Observe linear underfitting on XOR with 1 hidden unit, then expand to ≥4 units to achieve MSE < 0.05.',
    goalLabel: 'XOR · Loss < 0.05',
    preset: { dataset: 'xor', hiddenSizes: [1], activation: 'tanh', lr: 0.4 },
    boostPreset: { dataset: 'xor', hiddenSizes: [4], activation: 'tanh', lr: 0.4 },
    check: ({ datasetType, loss }) => datasetType === 'xor' && loss < 0.05,
  },
  {
    id: 'circle',
    title: 'Mission 3: Ring Master',
    dataset: 'circle',
    kidDesc: 'Separate the inner teal island from the outer coral ring by combining at least 3 helper neurons.',
    deepDesc: 'Approximate a closed radial decision boundary on concentric circles until MSE < 0.05.',
    goalLabel: 'Circle · Loss < 0.05',
    preset: { dataset: 'circle', hiddenSizes: [4], activation: 'tanh', lr: 0.35 },
    check: ({ datasetType, loss }) => datasetType === 'circle' && loss < 0.05,
  },
  {
    id: 'spiral',
    title: 'Mission 4: Spiral Wizard',
    dataset: 'spiral',
    kidDesc: 'Stack 2 or 3 hidden layers (5–6 neurons each) to twist the boundary around the twin spirals!',
    deepDesc: 'Compose multiple hidden representations (e.g. [6, 6] or [6, 6, 4] with tanh) to drive Spiral MSE < 0.05.',
    goalLabel: 'Spiral · Loss < 0.05',
    preset: { dataset: 'spiral', hiddenSizes: [6, 6], activation: 'tanh', lr: 0.3 },
    check: ({ datasetType, loss }) => datasetType === 'spiral' && loss < 0.05,
  },
]

const GUIDED_STEPS = [
  {
    id: 1,
    shortLabel: 'One Straight Fence',
    title: 'Step 1: One Straight Fence (0 Hidden Layers)',
    kidStory:
      'Each dot on the map belongs to Team Teal or Team Coral. The shaded background is the AI’s guess map — blue where it guesses Teal, orange where it guesses Coral, and white right on the border. With 0 hidden layers, a single neuron can only draw ONE straight fence. Press Train and watch it spin into place!',
    deepStory:
      'With 0 hidden layers, the network reduces to a single logistic perceptron ŷ = σ(w₁x + w₂y + b). Because the decision boundary w₁x + w₂y + b = 0 is linear, it cleanly partitions linearly separable half-spaces.',
    idleHint:
      'Press Train (or +10 Epochs) and watch the single straight boundary rotate to separate Team Teal from Team Coral.',
    preset: { dataset: 'linear', hiddenSizes: [], activation: 'tanh', lr: 0.4 },
  },
  {
    id: 2,
    shortLabel: 'The XOR Trap',
    title: 'Step 2: The XOR Trap — When One Line Fails!',
    kidStory:
      'Now the dots are arranged like a checkerboard (XOR): opposite corners share the same team! Press Train with 0 hidden layers — can a single straight fence ever separate all four corners?',
    deepStory:
      'XOR is the classic non-linearly separable problem (Minsky & Papert, 1969). Train with 0 hidden layers to observe why a single hyperplane plateaus near 50% accuracy (MSE ≈ 0.25).',
    idleHint:
      'Press Train and watch carefully! Can 1 straight line ever put both Teal corners on the same side?',
    preset: { dataset: 'xor', hiddenSizes: [], activation: 'tanh', lr: 0.4 },
  },
  {
    id: 3,
    shortLabel: 'Hidden Layers Bend It',
    title: 'Step 3: Hidden Layers Bend the Map!',
    kidStory:
      'We just added a Hidden Layer of 4 helper neurons! Each helper draws its own simple fence, and the final output neuron combines their votes to bend the boundary around opposite corners. Press Train, then hover or click the map to watch individual neurons light up!',
    deepStory:
      'A hidden layer of 4 tanh units projects ℝ² into a 4D feature space where XOR becomes linearly separable. Train to watch the boundary warp, and probe points to inspect per-neuron activations.',
    idleHint:
      'Press Train to watch the 4 hidden neurons team up and bend the decision boundary around XOR!',
    preset: { dataset: 'xor', hiddenSizes: [4], activation: 'tanh', lr: 0.4 },
  },
  {
    id: 4,
    shortLabel: 'Full Playground',
    title: 'Step 4: Full Playground (All Controls Unlocked!)',
    kidStory:
      'You unlocked the entire lab! Switch between Linear, Circle, XOR, and Spiral, stack up to 3 hidden layers, compare Tanh / ReLU / Sigmoid activations, tune Learning Rate, and beat all 4 Experiment Missions!',
    deepStory:
      'Full MLP sandbox unlocked: experiment with dataset manifolds (Circle, Spiral), depth/width capacity (0–3 layers, 1–6 units), activation non-linearities (Tanh, ReLU, Sigmoid), and learning rate η.',
    idleHint:
      'Pick any dataset, build your own layer architecture, and press Train to test your hypothesis!',
    preset: { dataset: 'circle', hiddenSizes: [4], activation: 'tanh', lr: 0.35 },
  },
]

const CANVAS_SIZE = 320
const GRID_RES = 36
const MAX_SPARKLINE_POINTS = 100
const LOSS_TARGET = 0.05
const DEFAULT_PROBE = { x: 0.45, y: 0.45 }

function formatActivation(val, isOutput = false) {
  if (!Number.isFinite(val)) return '0.00'
  if (isOutput) return val.toFixed(2)
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}`
}

function getNodeActivationVisual(val, isOutput = false) {
  const centered = isOutput ? (val - 0.5) * 2 : Math.max(-1, Math.min(1, val))
  const intensity = Math.min(1, Math.abs(centered))

  if (intensity < 0.06) {
    return {
      fill: '#f8fafc',
      stroke: '#94a3b8',
      textColor: '#0f172a',
      glow: null,
    }
  }

  if (centered > 0) {
    // Positive activation -> Teal / Sky glow
    const r = Math.round(240 - intensity * (240 - 14))
    const g = Math.round(249 - intensity * (249 - 165))
    const b = Math.round(255 - intensity * (255 - 233))
    return {
      fill: `rgb(${r}, ${g}, ${b})`,
      stroke: '#0284c7',
      textColor: intensity > 0.52 ? '#ffffff' : '#0c4a6e',
      glow: intensity > 0.28 ? 'url(#pgNodeGlowTeal)' : null,
    }
  }

  // Negative activation -> Coral / Rose glow
  const r = Math.round(255 - intensity * (255 - 244))
  const g = Math.round(241 - intensity * (241 - 63))
  const b = Math.round(242 - intensity * (242 - 94))
  return {
    fill: `rgb(${r}, ${g}, ${b})`,
    stroke: '#e11d48',
    textColor: intensity > 0.52 ? '#ffffff' : '#881337',
    glow: intensity > 0.28 ? 'url(#pgNodeGlowCoral)' : null,
  }
}

function countParameters(layerSizes) {
  let total = 0
  for (let i = 0; i < layerSizes.length - 1; i++) {
    total += layerSizes[i] * layerSizes[i + 1] + layerSizes[i + 1]
  }
  return total
}

function DatasetGlyph({ type }) {
  if (type === 'linear') {
    return (
      <svg className="pg-dataset-icon" viewBox="0 0 20 20" aria-hidden="true">
        <line x1="3" y1="17" x2="17" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
        <circle cx="6" cy="6" r="2.3" fill="#f97316" />
        <circle cx="14" cy="14" r="2.3" fill="#0ea5e9" />
      </svg>
    )
  }
  if (type === 'circle') {
    return (
      <svg className="pg-dataset-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="none" stroke="#f97316" strokeWidth="2.2" strokeDasharray="3 2" />
        <circle cx="10" cy="10" r="3" fill="#0ea5e9" />
      </svg>
    )
  }
  if (type === 'xor') {
    return (
      <svg className="pg-dataset-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="2.6" fill="#f97316" />
        <circle cx="14.5" cy="14.5" r="2.6" fill="#f97316" />
        <circle cx="14.5" cy="5.5" r="2.6" fill="#0ea5e9" />
        <circle cx="5.5" cy="14.5" r="2.6" fill="#0ea5e9" />
      </svg>
    )
  }
  return (
    <svg className="pg-dataset-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 10 C10 6, 15 6, 15 10 C15 15, 7 16, 5 11" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 10 C10 14, 5 14, 5 10 C5 5, 13 4, 15 9" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function LossSparkline({ history }) {
  const width = 280
  const height = 54
  const padX = 4
  const padY = 6

  if (!history || history.length === 0) {
    return <svg className="pg-sparkline-svg" viewBox={`0 0 ${width} ${height}`} />
  }

  const maxLoss = Math.max(0.32, ...history)
  const targetY = padY + (1 - Math.min(1, LOSS_TARGET / maxLoss)) * (height - padY * 2)

  const coords = history.map((val, idx) => {
    const x =
      history.length === 1
        ? width / 2
        : padX + (idx / (history.length - 1)) * (width - padX * 2)
    const clamped = Math.max(0, Math.min(maxLoss, val))
    const y = padY + (1 - clamped / maxLoss) * (height - padY * 2)
    return [x, y]
  })

  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${height - padY} L${coords[0][0].toFixed(1)},${height - padY} Z`
      : ''

  const last = coords[coords.length - 1]
  const latestLoss = history[history.length - 1]

  return (
    <svg
      className="pg-sparkline-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Training loss curve currently at ${latestLoss.toFixed(4)}`}
    >
      <defs>
        <linearGradient id="pgLossFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line
        x1={padX}
        y1={targetY}
        x2={width - padX}
        y2={targetY}
        stroke="#10b981"
        strokeWidth="1.2"
        strokeDasharray="4 3"
      />
      <text x={width - padX - 2} y={Math.max(10, targetY - 3)} textAnchor="end" fontSize="9" fill="#059669" fontWeight="700">
        Goal 0.05
      </text>
      {areaPath && <path d={areaPath} fill="url(#pgLossFill)" />}
      <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.6" fill={latestLoss < LOSS_TARGET ? '#10b981' : '#4f46e5'} stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  )
}

function NetworkDiagramSVG({ snapshot, activations, isDeepDive }) {
  const width = 560
  const height = 276
  const { layerSizes, layers } = snapshot
  const numCols = layerSizes.length
  const marginX = 56
  const topY = 38
  const bottomY = height - 26

  const colPositions = layerSizes.map((count, colIdx) => {
    const x =
      numCols === 1
        ? width / 2
        : marginX + (colIdx / (numCols - 1)) * (width - marginX * 2)
    const usableH = bottomY - topY
    const stepY = count > 1 ? Math.min(42, usableH / (count - 1)) : 0
    const startY = topY + (usableH - stepY * (count - 1)) / 2
    const nodes = Array.from({ length: count }, (_, nodeIdx) => ({
      x,
      y: startY + nodeIdx * stepY,
    }))
    return { x, nodes }
  })

  const edges = []
  for (let l = 0; l < layers.length; l++) {
    const fromNodes = colPositions[l].nodes
    const toNodes = colPositions[l + 1].nodes
    const weights = layers[l].weights
    const srcActs = activations?.[l] || []
    for (let j = 0; j < toNodes.length; j++) {
      for (let i = 0; i < fromNodes.length; i++) {
        const w = weights[j][i]
        const srcAct = srcActs[i] ?? 0
        const signal = srcAct * w
        const mag = Math.abs(w)
        const signalMag = Math.abs(signal)
        const isActiveSignal = signalMag >= 0.22
        const strokeWidth = Math.min(5.2, 0.75 + mag * 1.15 + signalMag * 0.45)
        const opacity = Math.min(0.96, 0.16 + mag * 0.22 + signalMag * 0.34)
        edges.push({
          key: `${l}-${i}-${j}`,
          x1: fromNodes[i].x,
          y1: fromNodes[i].y,
          x2: toNodes[j].x,
          y2: toNodes[j].y,
          w,
          signal,
          signalMag,
          isActiveSignal,
          color: w >= 0 ? '#0ea5e9' : '#f43f5e',
          signalColor: signal >= 0 ? '#38bdf8' : '#fb7185',
          strokeWidth,
          opacity,
        })
      }
    }
  }

  return (
    <svg
      className="pg-network-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Neural network diagram with live activations across layers ${layerSizes.join(' to ')}`}
    >
      <defs>
        <filter id="pgEdgeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="pgNodeGlowTeal" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pgNodeGlowCoral" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#f43f5e" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Column headers */}
      {colPositions.map((col, colIdx) => {
        let label = `Hidden ${colIdx}`
        if (colIdx === 0) label = 'Inputs'
        else if (colIdx === numCols - 1) label = 'Output'
        return (
          <text
            key={`hdr-${colIdx}`}
            x={col.x}
            y={16}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#64748b"
          >
            {label}
          </text>
        )
      })}

      {/* Active signal-carrying glow underlay */}
      <g>
        {edges
          .filter((e) => e.isActiveSignal)
          .map((e) => (
            <line
              key={`glow-${e.key}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.signalColor}
              strokeWidth={(e.strokeWidth + 2.4).toFixed(2)}
              strokeOpacity={Math.min(0.45, 0.12 + e.signalMag * 0.25).toFixed(2)}
              strokeLinecap="round"
              filter="url(#pgEdgeGlow)"
            />
          ))}
      </g>

      {/* Weighted connections */}
      <g>
        {edges.map((e) => (
          <line
            key={e.key}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={e.color}
            strokeWidth={e.strokeWidth.toFixed(2)}
            strokeOpacity={e.opacity.toFixed(2)}
            strokeLinecap="round"
          >
            <title>
              {`Weight: ${e.w >= 0 ? '+' : ''}${e.w.toFixed(2)} | Live signal: ${e.signal >= 0 ? '+' : ''}${e.signal.toFixed(2)}`}
            </title>
          </line>
        ))}
      </g>

      {/* Nodes with live activation fills & numeric readouts */}
      {colPositions.map((col, colIdx) => {
        const isInput = colIdx === 0
        const isOutput = colIdx === numCols - 1
        const biases = !isInput ? layers[colIdx - 1]?.biases || [] : []
        const layerActs = activations?.[colIdx] || []

        return col.nodes.map((node, nodeIdx) => {
          const bias = !isInput ? biases[nodeIdx] ?? 0 : 0
          const actVal = layerActs[nodeIdx] ?? 0
          const vis = getNodeActivationVisual(actVal, isOutput)
          const radius = isInput || isOutput ? 14.5 : 12.5
          let label = isDeepDive ? `h${colIdx}.${nodeIdx + 1}` : `${nodeIdx + 1}`

          if (isInput) {
            label = nodeIdx === 0 ? 'x' : 'y'
          } else if (isOutput) {
            label = 'ŷ'
          }

          const valText = formatActivation(actVal, isOutput)

          return (
            <g key={`n-${colIdx}-${nodeIdx}`}>
              {vis.glow && (
                <circle cx={node.x} cy={node.y} r={radius + 8} fill={vis.glow} />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={vis.fill}
                stroke={vis.stroke}
                strokeWidth={isInput || isOutput ? 2.4 : 2.2}
              >
                <title>
                  {isInput
                    ? `Input ${label} = ${valText}`
                    : isOutput
                      ? `Output probability ŷ = ${(actVal * 100).toFixed(1)}% (bias: ${bias.toFixed(2)})`
                      : `Hidden neuron ${nodeIdx + 1}: activation = ${valText} (bias: ${bias.toFixed(2)})`}
                </title>
              </circle>
              <text
                x={node.x}
                y={node.y + 3.8}
                textAnchor="middle"
                fontSize={isDeepDive && !isInput && !isOutput ? '8.5' : '11'}
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill={vis.textColor}
              >
                {label}
              </text>
              <rect
                x={node.x - 19}
                y={node.y + radius + 2}
                width={38}
                height={13}
                rx={4}
                fill="rgba(255, 255, 255, 0.9)"
                stroke="rgba(148, 163, 184, 0.35)"
                strokeWidth="0.7"
              />
              <text
                x={node.x}
                y={node.y + radius + 11.2}
                textAnchor="middle"
                fontSize="8.8"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill="#334155"
              >
                {valText}
              </text>
            </g>
          )
        })
      })}
    </svg>
  )
}

export default function PlaygroundLab() {
  const { isDeepDive, completedStages, markStageComplete, navigate } = useLearning()
  const stage = getStageById(2)
  const prevStage = STAGES.find((s) => s.id === 1)
  const nextStage = STAGES.find((s) => s.id === 3)
  const isStageDone = completedStages.has(2)

  // Progressive 4-step guided workflow state (starts on Step 1: One Straight Fence)
  const [guidedStep, setGuidedStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState(() => new Set())

  // Lab configuration state (matches Step 1 preset)
  const [datasetType, setDatasetType] = useState('linear')
  const [hiddenSizes, setHiddenSizes] = useState([])
  const [activation, setActivation] = useState('tanh')
  const [learningRate, setLearningRate] = useState(0.4)
  const [seed, setSeed] = useState(42)

  // Initial network & dataset for clean first render (no setState-in-effect)
  const dataset = useMemo(() => generateDataset(datasetType, 120, 42), [datasetType])
  const initialBundle = useMemo(() => {
    const initDataset = generateDataset('linear', 120, 42)
    const initNet = createMLP({
      inputSize: 2,
      hiddenSizes: [],
      outputSize: 1,
      activation: 'tanh',
      learningRate: 0.4,
      seed: 42,
    })
    const evalRes = initNet.evaluate(initDataset)
    const initTrace = initNet.forward([DEFAULT_PROBE.x, DEFAULT_PROBE.y])
    return {
      net: initNet,
      loss: evalRes.loss,
      accuracy: evalRes.accuracy,
      snapshot: initNet.getSnapshot(),
      trace: initTrace,
    }
  }, [])

  // Training & UI telemetry state
  const [isPlaying, setIsPlaying] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [loss, setLoss] = useState(initialBundle.loss)
  const [accuracy, setAccuracy] = useState(initialBundle.accuracy)
  const [lossHistory, setLossHistory] = useState(() => [initialBundle.loss])
  const [snapshot, setSnapshot] = useState(initialBundle.snapshot)
  const [solvedMissions, setSolvedMissions] = useState(() => new Set())
  const [recentCelebration, setRecentCelebration] = useState(null)

  // Live probe point for real-time node activation tracing
  const [pinnedProbe, setPinnedProbe] = useState(DEFAULT_PROBE)
  const [isPinned, setIsPinned] = useState(false)
  const [hoverProbe, setHoverProbe] = useState(null)
  const [probeTrace, setProbeTrace] = useState(initialBundle.trace)

  const activeProbe = hoverProbe || pinnedProbe

  // Refs for smooth 60fps training loop & canvas rendering
  const canvasRef = useRef(null)
  const offscreenCanvasRef = useRef(null)
  const mlpRef = useRef(initialBundle.net)
  const datasetRef = useRef(dataset)
  const lrRef = useRef(learningRate)
  const configRef = useRef({ datasetType, hiddenSizes })
  const solvedMissionsRef = useRef(solvedMissions)
  const activeProbeRef = useRef(activeProbe)
  const isPinnedRef = useRef(isPinned)
  const guidedStepRef = useRef(guidedStep)
  const rafRef = useRef(null)

  // Sync refs in effects (React Compiler safe)
  useEffect(() => {
    datasetRef.current = dataset
  }, [dataset])

  useEffect(() => {
    lrRef.current = learningRate
    if (mlpRef.current) {
      mlpRef.current.learningRate = learningRate
    }
  }, [learningRate])

  useEffect(() => {
    configRef.current = { datasetType, hiddenSizes }
  }, [datasetType, hiddenSizes])

  useEffect(() => {
    solvedMissionsRef.current = solvedMissions
  }, [solvedMissions])

  useEffect(() => {
    activeProbeRef.current = activeProbe
    isPinnedRef.current = isPinned
  }, [activeProbe, isPinned])

  useEffect(() => {
    guidedStepRef.current = guidedStep
  }, [guidedStep])

  const fireConfetti = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    confetti({
      particleCount: 72,
      spread: 68,
      origin: { y: 0.65 },
      colors: ['#6366f1', '#0ea5e9', '#10b981', '#f97316', '#f59e0b'],
    })
  }, [])

  const drawCanvas = useCallback((net, points, probe = activeProbeRef.current, pinned = isPinnedRef.current) => {
    const canvas = canvasRef.current
    if (!canvas || !net) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!offscreenCanvasRef.current) {
      const off = document.createElement('canvas')
      off.width = GRID_RES
      off.height = GRID_RES
      offscreenCanvasRef.current = off
    }
    const offCanvas = offscreenCanvasRef.current
    const offCtx = offCanvas.getContext('2d')
    const { values } = evaluateGrid(net, GRID_RES)
    const imgData = offCtx.createImageData(GRID_RES, GRID_RES)
    const data = imgData.data

    for (let r = 0; r < GRID_RES; r++) {
      const row = values[r]
      for (let c = 0; c < GRID_RES; c++) {
        const p = row[c]
        const idx = (r * GRID_RES + c) * 4
        if (p >= 0.5) {
          const t = Math.min(1, (p - 0.5) * 2)
          // Blend white -> sky-teal (#38bdf8)
          data[idx] = Math.round(255 - t * (255 - 56))
          data[idx + 1] = Math.round(255 - t * (255 - 189))
          data[idx + 2] = Math.round(255 - t * (255 - 248))
        } else {
          const t = Math.min(1, (0.5 - p) * 2)
          // Blend white -> soft coral-orange (#fb923c)
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
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(offCanvas, 0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Subtle coordinate crosshairs at x=0, y=0
    ctx.save()
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(CANVAS_SIZE / 2, 0)
    ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE)
    ctx.moveTo(0, CANVAS_SIZE / 2)
    ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2)
    ctx.stroke()
    ctx.restore()

    // Glowing data points
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]
      const cx = ((pt.x + 1) / 2) * CANVAS_SIZE
      const cy = ((1 - pt.y) / 2) * CANVAS_SIZE
      const fill = pt.label === 1 ? '#0284c7' : '#ea580c'

      ctx.save()
      ctx.shadowColor = pt.label === 1 ? 'rgba(14, 165, 233, 0.65)' : 'rgba(249, 115, 22, 0.65)'
      ctx.shadowBlur = 7
      ctx.beginPath()
      ctx.arc(cx, cy, 4.6, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.restore()

      ctx.beginPath()
      ctx.arc(cx, cy, 4.6, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.6
      ctx.stroke()
    }

    // Crisp crosshair marker for the live signal probe point
    if (probe) {
      const px = ((probe.x + 1) / 2) * CANVAS_SIZE
      const py = ((1 - probe.y) / 2) * CANVAS_SIZE

      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(px - 11, py)
      ctx.lineTo(px + 11, py)
      ctx.moveTo(px, py - 11)
      ctx.lineTo(px, py + 11)
      ctx.stroke()

      ctx.strokeStyle = pinned ? '#4f46e5' : '#0f172a'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(px - 10, py)
      ctx.lineTo(px + 10, py)
      ctx.moveTo(px, py - 10)
      ctx.lineTo(px, py + 10)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(px, py, 6.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.fill()
      ctx.lineWidth = 2.2
      ctx.strokeStyle = pinned ? '#4f46e5' : '#0f172a'
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(px, py, 2.2, 0, Math.PI * 2)
      ctx.fillStyle = pinned ? '#4f46e5' : '#0f172a'
      ctx.fill()
      ctx.restore()
    }
  }, [])

  const checkMissions = useCallback(
    (currentLoss, currentEpoch) => {
      if (currentEpoch <= 0 || currentLoss >= LOSS_TARGET) return
      const { datasetType: ds, hiddenSizes: hs } = configRef.current
      const alreadySolved = solvedMissionsRef.current

      const newlySolved = MISSIONS.filter(
        (m) => !alreadySolved.has(m.id) && m.check({ datasetType: ds, hiddenSizes: hs, loss: currentLoss }),
      )

      if (newlySolved.length > 0) {
        const nextSet = new Set(alreadySolved)
        for (const m of newlySolved) nextSet.add(m.id)
        solvedMissionsRef.current = nextSet
        setSolvedMissions(nextSet)
        setRecentCelebration(newlySolved[0].title)
        playSuccess()
        fireConfetti()
      }
    },
    [fireConfetti],
  )

  // Paint initial decision boundary on mount
  useEffect(() => {
    if (mlpRef.current) {
      drawCanvas(mlpRef.current, datasetRef.current)
    }
  }, [drawCanvas])

  // Rebuild network synchronously from user actions (avoids setState-in-effect)
  const rebuildNetwork = useCallback(
    ({
      nextDatasetType = datasetType,
      nextHiddenSizes = hiddenSizes,
      nextActivation = activation,
      nextLr = learningRate,
      nextSeed = seed,
    }) => {
      setIsPlaying(false)
      const nextPoints = generateDataset(nextDatasetType, 120, 42)
      const net = createMLP({
        inputSize: 2,
        hiddenSizes: nextHiddenSizes,
        outputSize: 1,
        activation: nextActivation,
        learningRate: nextLr,
        seed: nextSeed,
      })
      mlpRef.current = net
      datasetRef.current = nextPoints
      lrRef.current = nextLr
      configRef.current = { datasetType: nextDatasetType, hiddenSizes: nextHiddenSizes }

      const initial = net.evaluate(nextPoints)
      const probe = activeProbeRef.current
      const nextTrace = net.forward([probe.x, probe.y])
      setDatasetType(nextDatasetType)
      setHiddenSizes(nextHiddenSizes)
      setActivation(nextActivation)
      setLearningRate(nextLr)
      setSeed(nextSeed)
      setEpoch(0)
      setLoss(initial.loss)
      setAccuracy(initial.accuracy)
      setLossHistory([initial.loss])
      setSnapshot(net.getSnapshot())
      setProbeTrace(nextTrace)
      drawCanvas(net, nextPoints, probe, isPinnedRef.current)
    },
    [datasetType, hiddenSizes, activation, learningRate, seed, drawCanvas],
  )

  // Run N training epochs and update visuals
  const runEpochs = useCallback(
    (count) => {
      const net = mlpRef.current
      const pts = datasetRef.current
      if (!net || !pts) return

      let result = null
      for (let i = 0; i < count; i++) {
        result = net.trainStep(pts, lrRef.current)
      }
      if (!result) return

      const probe = activeProbeRef.current
      const nextTrace = net.forward([probe.x, probe.y])
      setEpoch(result.epoch)
      setLoss(result.loss)
      setAccuracy(result.accuracy)
      setLossHistory((prev) => {
        const next = [...prev, result.loss]
        if (next.length > MAX_SPARKLINE_POINTS) {
          return next.slice(next.length - MAX_SPARKLINE_POINTS)
        }
        return next
      })
      setSnapshot(net.getSnapshot())
      setProbeTrace(nextTrace)
      drawCanvas(net, pts, probe, isPinnedRef.current)
      checkMissions(result.loss, result.epoch)

      // Mark guided step progress automatically
      const stepNow = guidedStepRef.current
      const { datasetType: dsNow, hiddenSizes: hsNow } = configRef.current
      if (
        (stepNow === 1 && dsNow === 'linear' && (result.loss < LOSS_TARGET || result.accuracy >= 0.95)) ||
        (stepNow === 2 && dsNow === 'xor' && hsNow.length === 0 && result.epoch >= 25) ||
        (stepNow === 3 && dsNow === 'xor' && hsNow.length >= 1 && (result.loss < LOSS_TARGET || result.accuracy >= 0.95))
      ) {
        setCompletedSteps((prev) => {
          if (prev.has(stepNow)) return prev
          const next = new Set(prev)
          next.add(stepNow)
          return next
        })
      }
    },
    [drawCanvas, checkMissions],
  )

  // Animation loop when playing
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return undefined
    }

    const totalNeurons = hiddenSizes.reduce((sum, n) => sum + n, 0)
    const epochsPerFrame = totalNeurons >= 10 ? 3 : 5

    const tick = () => {
      runEpochs(epochsPerFrame)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isPlaying, hiddenSizes, runEpochs])

  // Architecture & dataset handlers
  const handleSelectDataset = (nextDatasetType) => {
    rebuildNetwork({ nextDatasetType })
  }

  const handleSelectActivation = (nextActivation) => {
    rebuildNetwork({ nextActivation })
  }

  const handleAddLayer = () => {
    if (hiddenSizes.length >= 3) return
    rebuildNetwork({ nextHiddenSizes: [...hiddenSizes, 4] })
  }

  const handleRemoveLayer = () => {
    if (hiddenSizes.length <= 0) return
    rebuildNetwork({ nextHiddenSizes: hiddenSizes.slice(0, -1) })
  }

  const handleAdjustNeurons = (layerIdx, delta) => {
    const nextHiddenSizes = hiddenSizes.map((count, idx) =>
      idx === layerIdx ? Math.max(1, Math.min(6, count + delta)) : count,
    )
    rebuildNetwork({ nextHiddenSizes })
  }

  const handleResetWeights = () => {
    playClick()
    rebuildNetwork({ nextSeed: seed + 17 })
  }

  const handleTogglePlay = () => {
    playClick()
    setIsPlaying((prev) => !prev)
  }

  const handleStep10 = () => {
    playClick()
    setIsPlaying(false)
    runEpochs(10)
  }

  const handleCompleteStage = () => {
    playSuccess()
    markStageComplete(2)
  }

  const applyPreset = (preset) => {
    rebuildNetwork({
      nextDatasetType: preset.dataset,
      nextHiddenSizes: preset.hiddenSizes,
      nextActivation: preset.activation,
      nextLr: preset.lr,
      nextSeed: seed + 1,
    })
  }

  const goToStep = (stepId) => {
    const targetStep = GUIDED_STEPS.find((s) => s.id === stepId)
    if (!targetStep) return
    playClick()
    guidedStepRef.current = stepId
    setGuidedStep(stepId)
    applyPreset(targetStep.preset)
  }

  const jumpToSandbox = () => {
    playClick()
    guidedStepRef.current = 4
    setGuidedStep(4)
  }

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
    const ny = Math.max(-1, Math.min(1, 1 - ((e.clientY - rect.top) / rect.height) * 2))
    return { x: nx, y: ny }
  }

  const handleCanvasMouseMove = (e) => {
    const net = mlpRef.current
    const coords = getCanvasCoords(e)
    if (!net || !coords) return
    const trace = net.forward([coords.x, coords.y])
    const nextHover = { x: coords.x, y: coords.y, prob: trace.output }
    activeProbeRef.current = nextHover
    setHoverProbe(nextHover)
    setProbeTrace(trace)
    drawCanvas(net, datasetRef.current, nextHover, isPinnedRef.current)
  }

  const handleCanvasMouseLeave = () => {
    const net = mlpRef.current
    setHoverProbe(null)
    activeProbeRef.current = pinnedProbe
    if (net) {
      setProbeTrace(net.forward([pinnedProbe.x, pinnedProbe.y]))
      drawCanvas(net, datasetRef.current, pinnedProbe, isPinnedRef.current)
    }
  }

  const handleCanvasClick = (e) => {
    const net = mlpRef.current
    const coords = getCanvasCoords(e)
    if (!net || !coords) return
    playClick()

    const distToPinned = Math.hypot(coords.x - pinnedProbe.x, coords.y - pinnedProbe.y)
    if (isPinned && distToPinned < 0.09) {
      // Clicking right on the pinned point unpins it back to default
      isPinnedRef.current = false
      activeProbeRef.current = DEFAULT_PROBE
      setIsPinned(false)
      setPinnedProbe(DEFAULT_PROBE)
      setHoverProbe(null)
      setProbeTrace(net.forward([DEFAULT_PROBE.x, DEFAULT_PROBE.y]))
      drawCanvas(net, datasetRef.current, DEFAULT_PROBE, false)
      return
    }

    const trace = net.forward([coords.x, coords.y])
    isPinnedRef.current = true
    activeProbeRef.current = coords
    setIsPinned(true)
    setPinnedProbe(coords)
    setHoverProbe({ x: coords.x, y: coords.y, prob: trace.output })
    setProbeTrace(trace)
    drawCanvas(net, datasetRef.current, coords, true)
  }

  const handleUnpinProbe = () => {
    const net = mlpRef.current
    playClick()
    isPinnedRef.current = false
    activeProbeRef.current = DEFAULT_PROBE
    setIsPinned(false)
    setPinnedProbe(DEFAULT_PROBE)
    setHoverProbe(null)
    if (net) {
      setProbeTrace(net.forward([DEFAULT_PROBE.x, DEFAULT_PROBE.y]))
      drawCanvas(net, datasetRef.current, DEFAULT_PROBE, false)
    }
  }

  const totalParams = countParameters(snapshot.layerSizes)
  const activeDatasetMeta = DATASET_OPTIONS.find((d) => d.id === datasetType) || DATASET_OPTIONS[0]
  const activeStepMeta = GUIDED_STEPS.find((s) => s.id === guidedStep) || GUIDED_STEPS[0]

  // Progressive UI disclosure flags (never locks out users — click any step or Free Sandbox!)
  const showDatasetPicker = guidedStep === 4
  const showLayerControls = guidedStep >= 3
  const showAdvancedHyper = guidedStep === 4
  const showMissions = guidedStep === 4

  // Dynamic "What's Happening Right Now" Live Narrator
  const isStuckOnXor = datasetType === 'xor' && hiddenSizes.length === 0 && epoch >= 25
  const isSolvedNow = epoch > 0 && (loss < LOSS_TARGET || accuracy >= 0.95)
  const probeTeamLabel = probeTrace.output >= 0.5 ? 'Teal' : 'Coral'
  const probePct = Math.round(
    (probeTrace.output >= 0.5 ? probeTrace.output : 1 - probeTrace.output) * 100,
  )

  let narratorTone = 'is-idle'
  let narratorBadge = 'Ready'
  let narratorText = activeStepMeta.idleHint
  let narratorCtaLabel = null
  let narratorNextStep = null

  if (isStuckOnXor) {
    narratorTone = 'is-stuck'
    narratorBadge = 'Stuck at 1969 Limit!'
    narratorText = `After ${epoch} rounds, accuracy is stuck near ${Math.round(accuracy * 100)}% (Loss ${loss.toFixed(3)})! No single straight fence can ever put opposite XOR corners on the same side — that’s why neural networks need a Hidden Layer!`
    narratorCtaLabel = 'Add a Hidden Layer (4 Neurons) →'
    narratorNextStep = 3
  } else if (isSolvedNow) {
    narratorTone = 'is-solved'
    narratorBadge = 'Solved!'
    if (guidedStep === 1) {
      narratorText = `Nice! In ${epoch} epochs, one straight fence separated Team Teal and Team Coral (${Math.round(accuracy * 100)}% accuracy, Loss ${loss.toFixed(3)}). Ready to see a puzzle that stumps a single straight line?`
      narratorCtaLabel = 'Next: Step 2 (The XOR Trap) →'
      narratorNextStep = 2
    } else if (guidedStep === 3) {
      narratorText = `You cracked XOR! The ${hiddenSizes[0] || 4} hidden neurons teamed up to bend the boundary around opposite corners (${Math.round(accuracy * 100)}% accuracy). Hover the map to see which hidden neurons fire for each corner!`
      narratorCtaLabel = 'Next: Step 4 (Full Playground) →'
      narratorNextStep = 4
    } else {
      narratorText = `Awesome! Your network separated ${activeDatasetMeta.label} at ${Math.round(accuracy * 100)}% accuracy (Loss ${loss.toFixed(3)}). Try a harder dataset or tweak the architecture!`
    }
  } else if (isPlaying) {
    narratorTone = 'is-training'
    narratorBadge = 'Training Live'
    narratorText =
      hiddenSizes.length === 0
        ? `Epoch ${epoch}: The neuron is nudging its 2 weights (watch the Teal & Coral lines thicken or flip!) to spin the straight fence and shrink Loss (${loss.toFixed(3)}).`
        : `Epoch ${epoch}: Backpropagation is tuning all ${totalParams} weights & biases (watch the lines change thickness!) so the hidden neurons bend the map and shrink Loss (${loss.toFixed(3)}).`
  } else if (epoch > 0) {
    narratorTone = 'is-idle'
    narratorBadge = 'Paused'
    narratorText = `Paused at Epoch ${epoch} (${Math.round(accuracy * 100)}% accuracy, Loss ${loss.toFixed(3)}). Press Train to keep learning, or hover/click the 2D map to inspect any point through the neurons.`
  }

  return (
    <div className="lab-page">
      {/* Stage Header */}
      <header className="lab-header" style={{ '--stage-accent': stage?.color || '#6366f1' }}>
        <div>
          <div className="stage-card-badges">
            <span
              className="badge"
              style={{
                background: '#6366f11a',
                color: '#6366f1',
                border: '1px solid #6366f144',
              }}
            >
              Stage 2 · {stage?.level || 'Beginner'}
            </span>
            <span className="badge badge-subtle">{stage?.ageBadge || 'Ages 8+'}</span>
            <span className={`badge ${isDeepDive ? 'badge-deep' : 'badge-explorer'}`}>
              {isDeepDive ? 'Deep-Dive Mode' : 'Explorer Mode'}
            </span>
            {isStageDone && (
              <span className="badge badge-success">
                <CheckCircle2 size={13} />
                Completed
              </span>
            )}
          </div>
          <h1>{stage?.title || 'Layers & Boundaries'}</h1>
          <p className="stage-card-subtitle">
            {stage?.subtitle || 'Team up neurons to draw curved decision maps'}
          </p>
        </div>

        <button
          type="button"
          className={`btn ${isStageDone ? 'btn-success' : 'btn-secondary'}`}
          onClick={handleCompleteStage}
        >
          <CheckCircle2 size={16} />
          <span>{isStageDone ? 'Stage 2 Completed' : 'Mark Stage 2 Complete'}</span>
        </button>
      </header>

      <div className="pg-layout">
        {/* Progressive 4-Step Guided Workflow Bar + Story Card */}
        <section className="lab-card pg-guided-card" aria-label="Progressive guided workflow">
          <div className="pg-stepper-head">
            <div className="pg-step-pills" role="tablist" aria-label="Guided discovery steps">
              {GUIDED_STEPS.map((step) => {
                const isActive = guidedStep === step.id
                const isDone = completedSteps.has(step.id)
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`pg-step-pill ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                    onClick={() => goToStep(step.id)}
                  >
                    <span className="pg-step-num">{isDone ? '✓' : step.id}</span>
                    <span>{step.shortLabel}</span>
                  </button>
                )
              })}
            </div>

            {guidedStep < 4 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={jumpToSandbox}
              >
                <Sparkles size={14} />
                <span>Jump to Free Sandbox</span>
              </button>
            )}
          </div>

          <div className="pg-story-box">
            <div className="pg-story-title">{activeStepMeta.title}</div>
            <p className="pg-story-text">
              {isDeepDive ? activeStepMeta.deepStory : activeStepMeta.kidStory}
            </p>
            {isDeepDive && (
              <div className="pg-formula-grid">
                <div className="formula-box">
                  Forward: z⁽ˡ⁾ = W⁽ˡ⁾a⁽ˡ⁻¹⁾ + b⁽ˡ⁾, &nbsp; a⁽ˡ⁾ = f(z⁽ˡ⁾)
                </div>
                <div className="formula-box">
                  MSE Loss: L = (1/N) Σ (ŷᵢ − yᵢ)², &nbsp; θ ← θ − η∇L
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Top Control Bar: Training Controls (+ Dataset Selector in Step 4) */}
        <section className="lab-card pg-toolbar" aria-label="Dataset and training controls">
          <div className="pg-toolbar-top">
            {showDatasetPicker ? (
              <div className="pg-toolbar-group">
                <span className="pg-group-label">Dataset</span>
                <div className="pg-dataset-pills" role="group" aria-label="Choose dataset">
                  {DATASET_OPTIONS.map((ds) => (
                    <button
                      key={ds.id}
                      type="button"
                      className={`pg-dataset-btn ${datasetType === ds.id ? 'is-active' : ''}`}
                      onClick={() => handleSelectDataset(ds.id)}
                      title={isDeepDive ? ds.deepDesc : ds.kidDesc}
                    >
                      <DatasetGlyph type={ds.id} />
                      <span>{ds.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pg-toolbar-group">
                <span className="pg-group-label">Current Puzzle</span>
                <span className="badge badge-subtle">
                  <DatasetGlyph type={activeDatasetMeta.id} />
                  <TermTip id={activeDatasetMeta.id}>{activeDatasetMeta.label}</TermTip>
                </span>
                <span className="badge badge-subtle">
                  {hiddenSizes.length === 0
                    ? '0 Hidden Layers (1 Neuron)'
                    : `${hiddenSizes.length} Hidden Layer (${hiddenSizes.join(', ')} neurons)`}
                </span>
              </div>
            )}

            <div className="pg-toolbar-group">
              <button
                type="button"
                className={`btn pg-play-btn ${isPlaying ? 'is-running' : 'btn-primary'}`}
                onClick={handleTogglePlay}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span>{isPlaying ? 'Pause' : 'Train'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleStep10}
                title="Run 10 training epochs"
              >
                <StepForward size={15} />
                <span>+10 Epochs</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetWeights}
                title="Reset network weights with a fresh random seed"
              >
                <RotateCcw size={15} />
                <span>Reset Weights</span>
              </button>
            </div>
          </div>

          {/* Immediate 1-line plain-English dataset explainer + clickable TermTips */}
          {showDatasetPicker && (
            <div className="pg-inline-explainer">
              <span>
                <TermTip id={activeDatasetMeta.id}>{activeDatasetMeta.label}</TermTip>:{' '}
                {isDeepDive
                  ? activeDatasetMeta.deepDesc
                  : getGlossaryEntry(activeDatasetMeta.id)?.plain || activeDatasetMeta.kidDesc}
              </span>
              <span className="pg-term-chips" aria-label="Dataset glossary quick links">
                <span>Compare:</span>
                {DATASET_OPTIONS.filter((ds) => ds.id !== activeDatasetMeta.id).map((ds) => (
                  <TermTip key={`tip-${ds.id}`} id={ds.id}>
                    {ds.label}
                  </TermTip>
                ))}
              </span>
            </div>
          )}
        </section>

        {/* Dynamic "What's Happening Right Now" Live Narrator Banner */}
        <section
          className={`pg-narrator ${narratorTone}`}
          aria-live="polite"
          aria-label="What is happening right now"
        >
          <div className="pg-narrator-left">
            <span className="pg-narrator-badge">{narratorBadge}</span>
            <div className="pg-narrator-copy">
              <span>{narratorText}</span>
              <span className="pg-narrator-probe">
                Testing point{' '}
                <strong className="font-mono">
                  ({activeProbe.x.toFixed(2)}, {activeProbe.y.toFixed(2)})
                </strong>{' '}
                → AI predicts{' '}
                <strong>
                  {probePct}% {probeTeamLabel}
                </strong>
              </span>
            </div>
          </div>

          {narratorCtaLabel && narratorNextStep !== null && (
            <div className="pg-narrator-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => goToStep(narratorNextStep)}
              >
                <span>{narratorCtaLabel}</span>
              </button>
            </div>
          )}
        </section>

        {/* Celebration Toast when a Mission is Solved */}
        {recentCelebration && (
          <div className="callout-kid" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={18} color="#0d9488" />
              <span>
                <strong>Awesome!</strong> You solved <strong>{recentCelebration}</strong> (Loss dropped below 0.05)!
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRecentCelebration(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Workspace: 2D Decision Boundary Canvas + Live SVG Network Architecture */}
        <section className="pg-workspace">
          {/* Left Panel: 2D Decision Boundary + Live Metrics */}
          <div className="lab-card pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title">
                <Sparkles size={18} color="#6366f1" />
                <span>
                  2D <TermTip id="decision-boundary">Decision Boundary</TermTip> Map
                </span>
              </h2>
              <span className="badge badge-subtle">
                {activeDatasetMeta.label}
              </span>
            </div>

            <div className="pg-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="pg-canvas"
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={handleCanvasMouseLeave}
                onClick={handleCanvasClick}
              />
              {hoverProbe && (
                <div className="pg-canvas-probe">
                  ({hoverProbe.x.toFixed(2)}, {hoverProbe.y.toFixed(2)}) →{' '}
                  {Math.round(hoverProbe.prob * 100)}% Teal {isPinned ? '· Click to move' : '· Click to pin'}
                </div>
              )}
            </div>

            {/* Explicit Visual Legend Pills for 2D Decision Map */}
            <div className="pg-legend-pills" aria-label="2D map legend">
              <span className="pg-legend-pill">
                <span className="pg-dot-swatch pg-dot-teal" />
                Teal Dot = Team A
              </span>
              <span className="pg-legend-pill">
                <span className="pg-dot-swatch pg-dot-coral" />
                Coral Dot = Team B
              </span>
              <span className="pg-legend-pill">
                <span className="pg-swatch-shade" />
                Shaded Area = AI’s Guess
              </span>
              <span className="pg-legend-pill">
                <span className="pg-swatch-crosshair" />
                Crosshair = Live Probe
              </span>
            </div>

            {/* Live Epoch, Loss, Accuracy Metrics */}
            <div className="pg-metrics-grid">
              <div className="pg-metric-box">
                <span className="pg-metric-label">
                  <TermTip id="epoch">Epoch</TermTip>
                </span>
                <span className="pg-metric-val">{epoch}</span>
              </div>
              <div className="pg-metric-box">
                <span className="pg-metric-label">
                  <TermTip id="loss">{isDeepDive ? 'MSE Loss' : 'Loss'}</TermTip>
                </span>
                <span className={`pg-metric-val ${loss < LOSS_TARGET ? 'is-solved' : ''}`}>
                  {loss.toFixed(4)}
                </span>
              </div>
              <div className="pg-metric-box">
                <span className="pg-metric-label">Accuracy</span>
                <span className={`pg-metric-val ${accuracy >= 0.96 ? 'is-solved' : ''}`}>
                  {Math.round(accuracy * 100)}%
                </span>
              </div>
            </div>

            {/* Mini SVG Loss Sparkline */}
            <div className="pg-sparkline-box">
              <div className="pg-sparkline-head">
                <span>{isDeepDive ? 'Loss Trajectory (MSE)' : 'Learning Curve (Lower is Better)'}</span>
                <span>{loss < LOSS_TARGET ? 'Solved!' : 'Target < 0.05'}</span>
              </div>
              <LossSparkline history={lossHistory} />
            </div>
          </div>

          {/* Right Panel: Live Network Architecture Diagram & Builder */}
          <div className="lab-card pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title">
                <Layers size={18} color="#6366f1" />
                <span>Network Brain Builder</span>
              </h2>
              <span className="badge badge-subtle">
                <Cpu size={13} />
                {isDeepDive
                  ? `${snapshot.layerSizes.join('–')} · ${totalParams} params`
                  : `${hiddenSizes.length} Hidden ${hiddenSizes.length === 1 ? 'Layer' : 'Layers'}`}
              </span>
            </div>

            {/* Add / Remove Hidden Layers (Unlocked from Step 3 onward) */}
            {showLayerControls && (
              <div className="pg-arch-controls">
                <div className="pg-layer-stepper">
                  <span className="pg-group-label">
                    <TermTip id="hidden-layer">Hidden Layers</TermTip>
                  </span>
                  <button
                    type="button"
                    className="pg-icon-btn"
                    onClick={handleRemoveLayer}
                    disabled={hiddenSizes.length <= 0}
                    aria-label="Remove hidden layer"
                  >
                    <Minus size={15} />
                  </button>
                  <strong className="font-mono">{hiddenSizes.length}</strong>
                  <button
                    type="button"
                    className="pg-icon-btn"
                    onClick={handleAddLayer}
                    disabled={hiddenSizes.length >= 3}
                    aria-label="Add hidden layer"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <span className="pg-helper-note">
                  {hiddenSizes.length === 0
                    ? 'Direct 2 → 1 neuron (straight line only)'
                    : 'Click + / − below to add or remove helper neurons'}
                </span>
              </div>
            )}

            {/* Live Signal Probe Banner */}
            <div className="pg-probe-banner">
              <div className="pg-probe-banner-main">
                <strong>Live Signal Probe:</strong>
                <span className="font-mono">
                  ({activeProbe.x.toFixed(2)}, {activeProbe.y.toFixed(2)})
                </span>
                <span>→</span>
                <span
                  className={`pg-probe-pill ${probeTrace.output >= 0.5 ? 'is-teal' : 'is-coral'}`}
                >
                  ŷ = {Math.round(probeTrace.output * 100)}%{' '}
                  {probeTrace.output >= 0.5 ? 'Teal' : 'Coral'}
                </span>
                <span>— hover or click the 2D map to test any point through the neurons!</span>
              </div>
              {isPinned && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleUnpinProbe}
                >
                  Unpin Probe
                </button>
              )}
            </div>

            {/* Live SVG Architecture Diagram */}
            <div className="pg-svg-stage">
              <NetworkDiagramSVG
                snapshot={snapshot}
                activations={probeTrace.activations}
                isDeepDive={isDeepDive}
              />

              {/* Per-Layer Neuron Steppers (Step 3+) */}
              {showLayerControls && (
                <div className="pg-neuron-steppers">
                  {hiddenSizes.length === 0 ? (
                    <span className="pg-helper-note">
                      0 hidden layers: inputs connect directly to the output neuron (only straight lines possible!).
                    </span>
                  ) : (
                    hiddenSizes.map((count, idx) => (
                      <div key={`layer-ctrl-${idx}`} className="pg-hidden-chip">
                        <span>H{idx + 1}:</span>
                        <button
                          type="button"
                          className="pg-mini-step"
                          onClick={() => handleAdjustNeurons(idx, -1)}
                          disabled={count <= 1}
                          aria-label={`Remove neuron from hidden layer ${idx + 1}`}
                        >
                          −
                        </button>
                        <span className="font-mono">{count}</span>
                        <button
                          type="button"
                          className="pg-mini-step"
                          onClick={() => handleAdjustNeurons(idx, 1)}
                          disabled={count >= 6}
                          aria-label={`Add neuron to hidden layer ${idx + 1}`}
                        >
                          +
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Explicit Visual Legend Pills for SVG Network Diagram */}
            <div className="pg-legend-pills" aria-label="Network diagram legend">
              <span className="pg-legend-pill">
                <span className="pg-line-swatch pg-line-pos" style={{ marginRight: 0 }} />
                Teal Line = Positive Vote (+)
              </span>
              <span className="pg-legend-pill">
                <span className="pg-line-swatch pg-line-neg" style={{ marginRight: 0 }} />
                Coral Line = Negative Vote (−)
              </span>
              <span className="pg-legend-pill">
                <span className="pg-swatch-node-glow" />
                Bright Node = Strongly Firing
              </span>
            </div>

            {/* Activation & Learning Rate Controls (Unlocked in Step 4: Full Playground) */}
            {showAdvancedHyper && (
              <div className="pg-hyper-grid">
                <div className="pg-hyper-box">
                  <div className="pg-hyper-head">
                    <span>
                      <TermTip id="activation">Activation Function</TermTip>
                    </span>
                    <span style={{ display: 'inline-flex', gap: 6, fontSize: '0.76rem' }}>
                      <TermTip id="tanh">Tanh</TermTip>
                      <TermTip id="relu">ReLU</TermTip>
                      <TermTip id="sigmoid">Sigmoid</TermTip>
                    </span>
                  </div>
                  <div className="pg-act-pills" role="group" aria-label="Choose activation function">
                    {Object.keys(ACTIVATION_INFO).map((actKey) => (
                      <button
                        key={actKey}
                        type="button"
                        className={`pg-act-btn ${activation === actKey ? 'is-active' : ''}`}
                        onClick={() => handleSelectActivation(actKey)}
                      >
                        {ACTIVATION_INFO[actKey].label}
                      </button>
                    ))}
                  </div>
                  <p className="pg-helper-note">
                    <strong>{ACTIVATION_INFO[activation].label}:</strong>{' '}
                    {isDeepDive ? ACTIVATION_INFO[activation].deep : ACTIVATION_INFO[activation].kid}
                  </p>
                </div>

                <div className="pg-hyper-box">
                  <div className="pg-hyper-head">
                    <label htmlFor="pg-lr-slider">
                      <TermTip id="learning-rate">
                        {isDeepDive ? 'Learning Rate (η)' : 'Learning Rate'}
                      </TermTip>
                    </label>
                    <span className="font-mono">{learningRate.toFixed(2)}</span>
                  </div>
                  <input
                    id="pg-lr-slider"
                    type="range"
                    className="pg-slider"
                    min="0.02"
                    max="1.2"
                    step="0.02"
                    value={learningRate}
                    onChange={(e) => setLearningRate(Number(e.target.value))}
                  />
                  <p className="pg-helper-note">
                    {isDeepDive
                      ? 'Scales gradient descent steps Δθ = −η∇L. Too small converges slowly; too large oscillates.'
                      : 'Bigger steps learn faster, but too fast can make the network bounce past the answer!'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Kid-Friendly Experiment Missions (Unlocked in Step 4: Full Playground) */}
        {showMissions && (
          <section className="lab-card pg-missions-card" aria-label="Experiment Missions">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title">
                <Trophy size={18} color="#f59e0b" />
                <span>Experiment Missions</span>
              </h2>
              <span className="badge badge-success">
                {solvedMissions.size} / {MISSIONS.length} Solved
              </span>
            </div>

            <div className="pg-missions-grid">
              {MISSIONS.map((mission) => {
                const isSolved = solvedMissions.has(mission.id)
                const isCurrent = datasetType === mission.dataset

                return (
                  <div
                    key={mission.id}
                    className={`pg-mission-item ${isSolved ? 'is-solved' : isCurrent ? 'is-active' : ''}`}
                  >
                    <div className="pg-mission-top">
                      <div className="pg-mission-title">{mission.title}</div>
                      {isSolved ? (
                        <span className="badge badge-success">
                          <CheckCircle2 size={12} />
                          Solved!
                        </span>
                      ) : (
                        <span className="badge badge-subtle">
                          {isCurrent ? 'Active' : 'Ready'}
                        </span>
                      )}
                    </div>

                    <p className="pg-mission-desc">
                      {isDeepDive ? mission.deepDesc : mission.kidDesc}
                    </p>

                    <div className="pg-mission-actions">
                      <span className="pg-mission-goal">{mission.goalLabel}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => applyPreset(mission.preset)}
                        >
                          {mission.id === 'xor' ? 'Try 1-Neuron' : 'Load Mission'}
                        </button>
                        {mission.boostPreset && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => applyPreset(mission.boostPreset)}
                          >
                            Try 4 Neurons
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer Navigation */}
      <nav className="lab-footer-nav" aria-label="Stage navigation">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(prevStage ? prevStage.route : '/')}
        >
          <ArrowLeft size={16} />
          <span>{prevStage ? `Stage ${prevStage.id}: ${prevStage.title}` : 'Back to Pathway'}</span>
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {!isStageDone && (
            <button
              type="button"
              className="btn btn-success"
              onClick={handleCompleteStage}
            >
              <CheckCircle2 size={16} />
              <span>Mark Stage 2 Complete</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(nextStage ? nextStage.route : '/stage/3')}
          >
            <span>Next: Stage 3 →</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>
    </div>
  )
}
