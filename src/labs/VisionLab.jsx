import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Camera,
  CameraOff,
  CheckCircle2,
  Eraser,
  Eye,
  Grid3X3,
  Image as ImageIcon,
  Pause,
  PenTool,
  Play,
  Plus,
  RefreshCw,
  SkipBack,
  SkipForward,
  Sparkles,
  Undo2,
  Upload,
  Wand2,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById, STAGES } from '../utils/pathwayLoader.js'
import {
  SAMPLE_GRIDS,
  KERNELS,
  KERNEL_LIST,
  createBlankGrid,
  cloneGrid,
  applyConvolutionStep,
  applyFullConvolution,
} from '../engine/convolution.js'
import { CHARSETS, createCharRecognizer } from '../engine/charRecognizer.js'
import { playClick, playRecognize, playSuccess } from '../utils/sound.js'
import './VisionLab.css'

/* ==========================================================================
   Helper Utilities
   ========================================================================== */

function formatKernelWeight(w) {
  if (Math.abs(w - 1 / 9) < 0.001) return '1/9'
  if (Number.isInteger(w)) return String(w)
  return w.toFixed(2)
}

function formatNumber(n) {
  if (Math.abs(n) < 0.005) return '0'
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

function getFeatureCellStyle(value, maxAbs) {
  const scale = maxAbs > 0 ? Math.min(1, Math.abs(value) / maxAbs) : 0
  if (Math.abs(value) < 0.01) {
    return { backgroundColor: '#1e293b', color: '#64748b' }
  }
  const alpha = 0.22 + scale * 0.78
  return {
    backgroundColor: `rgba(16, 185, 129, ${alpha.toFixed(2)})`,
    color: scale > 0.45 ? '#ffffff' : '#d1fae5',
  }
}

function getFilterVerdict(kernelId, value) {
  const absVal = Math.abs(value)
  const scoreStr = value > 0 ? `+${formatNumber(value)}` : formatNumber(value)
  if (absVal < 0.15) {
    return `No match here (score: ${scoreStr}) — the pixels inside this 3×3 magnifying glass don’t match the filter’s shape.`
  }
  if (kernelId === 'verticalEdge') {
    const side =
      value > 0
        ? 'empty space on the left and ink on the right'
        : 'ink on the left and empty space on the right'
    return absVal >= 2
      ? `Strong match! This 3×3 spot has ${side} — that’s a crisp vertical edge (score: ${scoreStr}).`
      : `Partial match! There’s a slight vertical edge here (${side}, score: ${scoreStr}).`
  }
  if (kernelId === 'horizontalEdge') {
    const side =
      value > 0
        ? 'empty space on top and ink below'
        : 'ink on top and empty space below'
    return absVal >= 2
      ? `Strong match! This 3×3 spot has ${side} — that’s a flat horizontal edge (score: ${scoreStr}).`
      : `Partial match! Slight horizontal edge detected (${side}, score: ${scoreStr}).`
  }
  if (kernelId === 'corner') {
    return `Corner spotted! Your shape turns sharply inside this 3×3 magnifying glass (score: ${scoreStr}).`
  }
  if (kernelId === 'sharpen') {
    return value > 0
      ? `Crisp detail boosted! The center pixel stands out from its neighbors (score: ${scoreStr}).`
      : `Edge contrast trimmed around this center pixel (score: ${scoreStr}).`
  }
  return `Softly blended! Average brightness of all 9 pixels here is ${Math.round(value * 100)}% (score: ${scoreStr}).`
}

/* ==========================================================================
   Built-in Sample Canvas Scenes (Camera-Free Fallback for Tab 2)
   ========================================================================== */

const SAMPLE_SCENES = [
  {
    id: 'desk',
    label: 'Study Desk',
    emoji: '💻',
    fallbackDetections: [
      { class: 'laptop', score: 0.92, bbox: [130, 125, 250, 185] },
      { class: 'cup', score: 0.84, bbox: [420, 215, 78, 95] },
      { class: 'book', score: 0.78, bbox: [50, 245, 110, 68] },
    ],
  },
  {
    id: 'street',
    label: 'City Street',
    emoji: '🚗',
    fallbackDetections: [
      { class: 'car', score: 0.94, bbox: [120, 235, 255, 115] },
      { class: 'traffic light', score: 0.87, bbox: [465, 55, 58, 130] },
      { class: 'stop sign', score: 0.81, bbox: [55, 120, 76, 76] },
    ],
  },
  {
    id: 'park',
    label: 'Sunny Park',
    emoji: '🚲',
    fallbackDetections: [
      { class: 'bicycle', score: 0.91, bbox: [115, 215, 210, 130] },
      { class: 'bench', score: 0.83, bbox: [365, 235, 195, 105] },
      { class: 'sports ball', score: 0.76, bbox: [315, 315, 52, 52] },
    ],
  },
]

function drawSampleScene(canvas, sceneId) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = 600
  const H = 450
  canvas.width = W
  canvas.height = H

  if (sceneId === 'desk') {
    // Wall & Desk background
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, W, 285)
    ctx.fillStyle = '#b45309'
    ctx.fillRect(0, 285, W, H - 285)
    ctx.fillStyle = '#92400e'
    ctx.fillRect(0, 285, W, 10)

    // Window light
    ctx.fillStyle = '#bae6fd'
    ctx.fillRect(40, 35, 140, 120)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(40, 35, 140, 120)

    // Laptop screen
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(150, 130, 210, 145)
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(162, 142, 186, 118)
    // Code lines on screen
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(178, 165, 95, 10)
    ctx.fillStyle = '#fef08a'
    ctx.fillRect(178, 186, 130, 10)
    ctx.fillStyle = '#bbf7d0'
    ctx.fillRect(178, 207, 80, 10)
    // Laptop base
    ctx.fillStyle = '#64748b'
    ctx.beginPath()
    ctx.moveTo(132, 275)
    ctx.lineTo(378, 275)
    ctx.lineTo(395, 305)
    ctx.lineTo(115, 305)
    ctx.closePath()
    ctx.fill()

    // Coffee Cup
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(428, 225, 58, 78)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(486, 262, 16, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.fillStyle = '#451a03'
    ctx.beginPath()
    ctx.ellipse(457, 225, 29, 8, 0, 0, Math.PI * 2)
    ctx.fill()

    // Book
    ctx.fillStyle = '#4f46e5'
    ctx.fillRect(52, 255, 102, 48)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(60, 263, 86, 32)
    ctx.fillStyle = '#4338ca'
    ctx.fillRect(52, 255, 16, 48)
    return
  }

  if (sceneId === 'street') {
    // Sky & road
    ctx.fillStyle = '#7dd3fc'
    ctx.fillRect(0, 0, W, 240)
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(0, 240, W, 50)
    ctx.fillStyle = '#334155'
    ctx.fillRect(0, 290, W, H - 290)
    // Road stripes
    ctx.fillStyle = '#facc15'
    for (let x = 25; x < W; x += 95) {
      ctx.fillRect(x, 365, 52, 10)
    }

    // Stop sign
    ctx.fillStyle = '#64748b'
    ctx.fillRect(88, 185, 10, 105)
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    const cx = 93
    const cy = 158
    const r = 34
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 8) + (i * Math.PI) / 4
      const px = cx + r * Math.cos(a)
      const py = cy + r * Math.sin(a)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 17px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('STOP', cx, cy + 6)

    // Traffic light
    ctx.fillStyle = '#475569'
    ctx.fillRect(490, 175, 10, 115)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(470, 62, 50, 118)
    const lights = ['#ef4444', '#facc15', '#22c55e']
    lights.forEach((color, idx) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(495, 88 + idx * 34, 12, 0, Math.PI * 2)
      ctx.fill()
    })

    // Car
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(130, 285, 235, 52)
    ctx.beginPath()
    ctx.moveTo(165, 285)
    ctx.lineTo(195, 242)
    ctx.lineTo(300, 242)
    ctx.lineTo(335, 285)
    ctx.closePath()
    ctx.fill()
    // Car windows
    ctx.fillStyle = '#bae6fd'
    ctx.fillRect(202, 250, 42, 28)
    ctx.fillRect(252, 250, 44, 28)
    // Wheels
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(180, 338, 26, 0, Math.PI * 2)
    ctx.arc(315, 338, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#cbd5e1'
    ctx.beginPath()
    ctx.arc(180, 338, 11, 0, Math.PI * 2)
    ctx.arc(315, 338, 11, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  // Park scene
  ctx.fillStyle = '#bae6fd'
  ctx.fillRect(0, 0, W, 240)
  // Sun
  ctx.fillStyle = '#fde047'
  ctx.beginPath()
  ctx.arc(520, 75, 38, 0, Math.PI * 2)
  ctx.fill()
  // Grass
  ctx.fillStyle = '#4ade80'
  ctx.fillRect(0, 240, W, H - 240)
  // Path
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(0, 335, W, 70)

  // Trees
  ctx.fillStyle = '#92400e'
  ctx.fillRect(75, 165, 22, 85)
  ctx.fillStyle = '#16a34a'
  ctx.beginPath()
  ctx.arc(86, 140, 48, 0, Math.PI * 2)
  ctx.fill()

  // Park Bench
  ctx.fillStyle = '#b45309'
  ctx.fillRect(375, 250, 175, 22)
  ctx.fillRect(375, 285, 175, 18)
  ctx.fillStyle = '#334155'
  ctx.fillRect(390, 272, 10, 62)
  ctx.fillRect(525, 272, 10, 62)

  // Bicycle
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(158, 308, 34, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(278, 308, 34, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(158, 308)
  ctx.lineTo(208, 252)
  ctx.lineTo(264, 252)
  ctx.lineTo(278, 308)
  ctx.moveTo(208, 252)
  ctx.lineTo(215, 308)
  ctx.lineTo(158, 308)
  ctx.stroke()

  // Sports ball
  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.arc(341, 341, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(341, 341, 22, 0, Math.PI * 2)
  ctx.stroke()
}

function drawBoundingBoxes(ctx, detections, canvasW, canvasH, sourceW, sourceH) {
  const scaleX = sourceW > 0 ? canvasW / sourceW : 1
  const scaleY = sourceH > 0 ? canvasH / sourceH : 1
  const palette = ['#10b981', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6']

  detections.forEach((det, idx) => {
    const [bx, by, bw, bh] = det.bbox
    const x = bx * scaleX
    const y = by * scaleY
    const w = bw * scaleX
    const h = bh * scaleY
    const color = palette[idx % palette.length]
    const pct = Math.round(det.score * 100)
    const label = `${det.class} ${pct}%`

    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, w, h)

    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif'
    const textW = ctx.measureText(label).width
    const pillH = 24
    const pillY = Math.max(4, y - pillH - 2)
    ctx.fillStyle = color
    ctx.fillRect(x, pillY, textW + 14, pillH)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, x + 7, pillY + 17)
  })
}

/* ==========================================================================
   Mini-Brain Classifier Engine (Tab 3: Feature Vector + Centroid & KNN)
   ========================================================================== */

const DEMO_TRAINING_EXAMPLES = {
  classA: [
    // Classic Star
    [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [1, 1, 0, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    // Compact Sparkle Star
    [
      [0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0],
      [0, 1, 0, 1, 0, 1, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    // Shifted Star
    [
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    // Hollow Starburst
    [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [1, 1, 1, 0, 0, 1, 1, 1],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  ],
  classB: [
    // Classic Smiley
    cloneGrid(SAMPLE_GRIDS.smiley.grid),
    // Wide Smile Face
    [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    // Small Cute Face
    [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    // Surprised Face
    [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  ],
}

function extractFeatureVector(grid) {
  const vec = []
  // 1. Raw 8x8 pixels (64 features)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      vec.push(grid[r][c] ? 1 : 0)
    }
  }
  // 2. Downsampled 4x4 spatial pooled blocks (16 shift-tolerant features)
  for (let br = 0; br < 4; br++) {
    for (let bc = 0; bc < 4; bc++) {
      const sum =
        (grid[br * 2][bc * 2] || 0) +
        (grid[br * 2][bc * 2 + 1] || 0) +
        (grid[br * 2 + 1][bc * 2] || 0) +
        (grid[br * 2 + 1][bc * 2 + 1] || 0)
      vec.push((sum / 4) * 1.4)
    }
  }
  // 3. Edge filter responses from our convolution engine (normalized)
  const vEdges = applyFullConvolution(grid, KERNELS.verticalEdge)
  const hEdges = applyFullConvolution(grid, KERNELS.horizontalEdge)
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      vec.push(Math.abs(vEdges.featureMap[r][c]) / 4)
      vec.push(Math.abs(hEdges.featureMap[r][c]) / 4)
    }
  }
  return vec
}

function cosineSimilarity(a, b) {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function euclideanDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

function averageVectors(vectors) {
  if (vectors.length === 0) return []
  const len = vectors[0].length
  const avg = new Array(len).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < len; i++) avg[i] += v[i]
  }
  for (let i = 0; i < len; i++) avg[i] /= vectors.length
  return avg
}

function classifyMiniBrain(queryGrid, examplesA, examplesB) {
  const activePixels = queryGrid.flat().reduce((acc, v) => acc + (v ? 1 : 0), 0)
  if (activePixels === 0 || examplesA.length === 0 || examplesB.length === 0) {
    return null
  }

  const qVec = extractFeatureVector(queryGrid)
  const vecsA = examplesA.map(extractFeatureVector)
  const vecsB = examplesB.map(extractFeatureVector)

  // Nearest-centroid cosine similarity
  const centroidA = averageVectors(vecsA)
  const centroidB = averageVectors(vecsB)
  const cosA = cosineSimilarity(qVec, centroidA)
  const cosB = cosineSimilarity(qVec, centroidB)

  // K-Nearest Neighbors (k = 3) inverse-distance weighting
  const allNeighbors = [
    ...vecsA.map((v) => ({ label: 'A', dist: euclideanDistance(qVec, v) })),
    ...vecsB.map((v) => ({ label: 'B', dist: euclideanDistance(qVec, v) })),
  ].sort((x, y) => x.dist - y.dist)

  const k = Math.min(3, allNeighbors.length)
  let knnScoreA = 0
  let knnScoreB = 0
  for (let i = 0; i < k; i++) {
    const w = 1 / (allNeighbors[i].dist + 0.35)
    if (allNeighbors[i].label === 'A') knnScoreA += w
    else knnScoreB += w
  }
  const knnTotal = knnScoreA + knnScoreB || 1
  const knnNormA = knnScoreA / knnTotal
  const knnNormB = knnScoreB / knnTotal

  // Blend centroid similarity + KNN and convert via temperature-scaled softmax
  const scoreA = cosA * 3.2 + knnNormA * 2.2
  const scoreB = cosB * 3.2 + knnNormB * 2.2
  const maxS = Math.max(scoreA, scoreB)
  const expA = Math.exp(scoreA - maxS)
  const expB = Math.exp(scoreB - maxS)
  const probA = expA / (expA + expB)
  const probB = expB / (expA + expB)

  return {
    winner: probA >= probB ? 'A' : 'B',
    probA,
    probB,
    cosA,
    cosB,
    nearestDist: allNeighbors[0]?.dist ?? 0,
  }
}

/* ==========================================================================
   Live Neural Network & Node Activations SVG (Draw Characters Tab)
   ========================================================================== */

function LiveCharNetworkDiagram({
  networkTrace,
  isDeepDive,
  highlightedInputIndex = null,
  onHoverInputIndex,
}) {
  const [hoveredNode, setHoveredNode] = useState(null) // { layer: 'input'|'hidden'|'output', index }
  const [pinnedNode, setPinnedNode] = useState(null)

  const activeFocus =
    hoveredNode ||
    (highlightedInputIndex !== null ? { layer: 'input', index: highlightedInputIndex } : null) ||
    pinnedNode

  const handleNodeClick = (layer, index) => {
    playClick()
    if (layer === 'input' && onHoverInputIndex) {
      onHoverInputIndex(pinnedNode?.layer === 'input' && pinnedNode.index === index ? null : index)
    }
    setPinnedNode((prev) =>
      prev && prev.layer === layer && prev.index === index ? null : { layer, index },
    )
  }

  if (!networkTrace) {
    return (
      <div className="vision-net-card" aria-label="Inside the Neural Network Live Node Activations">
        <div className="vision-net-head">
          <h3>Step 4: Inside the Neural Network — Live Node Activations</h3>
          <span className="badge badge-subtle">16 Pooled Zones → 12 Feature Detectors → 10 Outputs</span>
        </div>
        <div className="vision-net-empty">
          <Brain size={30} color="#34d399" />
          <p style={{ fontWeight: 700, color: '#f8fafc' }}>
            Draw a digit or letter above to watch signals flow through every neuron!
          </p>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            You’ll see all 16 pooled zones, 12 feature-detector neurons, and 10 character outputs light up in real time.
          </p>
        </div>
      </div>
    )
  }

  const { inputNodes, hiddenNodes, outputNodes, inputToHiddenEdges, hiddenToOutputEdges } =
    networkTrace

  const inputY = (idx) => 52 + idx * 24
  const hiddenY = (idx) => 56 + idx * 32
  const outputY = (idx) => 58 + idx * 36

  const isEdgeHighlighted = (kind, edge) => {
    if (!activeFocus) return null
    if (kind === 'ih') {
      if (activeFocus.layer === 'input') return edge.from === activeFocus.index
      if (activeFocus.layer === 'hidden') return edge.to === activeFocus.index
      return false
    }
    if (activeFocus.layer === 'hidden') return edge.from === activeFocus.index
    if (activeFocus.layer === 'output') return edge.to === activeFocus.index
    return false
  }

  // Build kid-friendly inspector caption for hovered/pinned node or default winner summary
  let inspectorCaption = ''
  if (activeFocus?.layer === 'hidden') {
    const hNode = hiddenNodes[activeFocus.index]
    if (hNode) {
      const pct = Math.round(hNode.activation * 100)
      const topTargets = hiddenToOutputEdges
        .filter((e) => e.from === activeFocus.index && e.weight > 0.05)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((e) => outputNodes[e.to]?.char)
        .filter(Boolean)
      const clueText =
        topTargets.length > 0 ? ` — strong clue for ${topTargets.join(', ')}` : ''
      inspectorCaption = isDeepDive
        ? `${hNode.label} neuron (${hNode.shortLabel}): activation = ${hNode.activation.toFixed(2)} (${pct}%)${clueText}. ${hNode.description}`
        : `${hNode.shortLabel} neuron is ${pct}% active${clueText}! (${hNode.description})`
    }
  } else if (activeFocus?.layer === 'output') {
    const oNode = outputNodes[activeFocus.index]
    if (oNode) {
      const pct = Math.round(oNode.prob * 100)
      const topDrivers = hiddenToOutputEdges
        .filter((e) => e.to === activeFocus.index && e.signal > 0.02)
        .sort((a, b) => b.signal - a.signal)
        .slice(0, 3)
        .map((e) => hiddenNodes[e.from]?.shortLabel)
        .filter(Boolean)
      const driverText =
        topDrivers.length > 0 ? ` — boosted by ${topDrivers.join(' + ')}` : ''
      inspectorCaption = `Output "${oNode.char}" (${pct}% probability)${driverText}.`
    }
  } else if (activeFocus?.layer === 'input') {
    const iNode = inputNodes[activeFocus.index]
    if (iNode) {
      const pct = Math.round(iNode.activation * 100)
      const fed = inputToHiddenEdges.filter((e) => e.from === activeFocus.index).length
      inspectorCaption = `Input Pixel Zone (row ${iNode.row + 1}, col ${iNode.col + 1}) is ${pct}% bright — sending signals to ${fed} feature detector(s).`
    }
  } else {
    const winner = outputNodes.find((n) => n.isWinner) || outputNodes[0]
    const topActiveHidden = [...hiddenNodes]
      .sort((a, b) => b.activation - a.activation)
      .slice(0, 3)
      .map((n) => `${n.shortLabel} (${Math.round(n.activation * 100)}%)`)
    inspectorCaption = winner
      ? `Top active clues for "${winner.char}": ${topActiveHidden.join(', ')}. Hover or click any neuron to trace its synapses!`
      : 'Hover or click any neuron to trace its live synapses!'
  }

  return (
    <div className="vision-net-card" aria-label="Inside the Neural Network Live Node Activations">
      <div className="vision-net-head">
        <h3>Step 4: Inside the Neural Network — Live Node Activations</h3>
        <div className="vision-net-legend">
          <span>
            <span className="vision-net-legend-dot" style={{ background: '#14b8a6' }} />
            Excitatory (+)
          </span>
          <span>
            <span className="vision-net-legend-dot" style={{ background: '#fb7185' }} />
            Inhibitory (−)
          </span>
          <span>Hover or click any neuron</span>
        </div>
      </div>

      <div className="vision-net-svg-wrap">
        <svg
          className="vision-net-svg"
          viewBox="0 0 880 440"
          role="img"
          aria-label="3-layer neural network showing live activations from 16 pooled zones through 12 feature detectors to 10 output characters"
        >
          <defs>
            <filter id="visionNodeGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Column Headers */}
          <text x="108" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10.5" fontWeight="700">
            INPUT LAYER (4×4 = 16 Pooled Zones)
          </text>
          <text x="424" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10.5" fontWeight="700">
            HIDDEN LAYER (12 Feature Detectors)
          </text>
          <text x="762" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10.5" fontWeight="700">
            OUTPUT LAYER (10 Predictions)
          </text>

          {/* Input -> Hidden Synapses */}
          <g>
            {inputToHiddenEdges.map((edge, idx) => {
              const x1 = 102
              const y1 = inputY(edge.from)
              const x2 = 366
              const y2 = hiddenY(edge.to)
              const highlighted = isEdgeHighlighted('ih', edge)
              const mag = Math.min(1, Math.abs(edge.signal) * 1.45)
              const baseOpacity = 0.08 + mag * 0.65
              const opacity =
                highlighted === null ? baseOpacity : highlighted ? Math.max(0.5, baseOpacity + 0.3) : 0.05
              const strokeWidth =
                highlighted === true ? 1.6 + mag * 2.4 : 0.8 + mag * 2.1
              const color = edge.signal >= 0 ? '#14b8a6' : '#fb7185'
              return (
                <path
                  key={`ih-${idx}`}
                  d={`M ${x1} ${y1} C ${x1 + 95} ${y1}, ${x2 - 95} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                />
              )
            })}
          </g>

          {/* Hidden -> Output Synapses */}
          <g>
            {hiddenToOutputEdges.map((edge, idx) => {
              const x1 = 494
              const y1 = hiddenY(edge.from)
              const x2 = 740
              const y2 = outputY(edge.to)
              const highlighted = isEdgeHighlighted('ho', edge)
              const mag = Math.min(1, Math.abs(edge.signal) * 1.6)
              const baseOpacity = 0.1 + mag * 0.72
              const opacity =
                highlighted === null ? baseOpacity : highlighted ? Math.max(0.55, baseOpacity + 0.3) : 0.05
              const strokeWidth =
                highlighted === true ? 1.8 + mag * 2.8 : 0.9 + mag * 2.4
              const color = edge.signal >= 0 ? '#10b981' : '#fb7185'
              return (
                <path
                  key={`ho-${idx}`}
                  d={`M ${x1} ${y1} C ${x1 + 90} ${y1}, ${x2 - 90} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                />
              )
            })}
          </g>

          {/* Column 1: 16 Input Pixel Zone Nodes */}
          <g>
            {inputNodes.map((node, idx) => {
              const cy = inputY(idx)
              const act = node.activation
              const isFocused = activeFocus?.layer === 'input' && activeFocus.index === idx
              const fill =
                act > 0.05
                  ? `rgba(20, 184, 166, ${(0.22 + act * 0.78).toFixed(2)})`
                  : '#1e293b'
              return (
                <g
                  key={`in-${node.id}`}
                  className="vision-net-node-hit"
                  onMouseEnter={() => {
                    setHoveredNode({ layer: 'input', index: idx })
                    if (onHoverInputIndex) onHoverInputIndex(idx)
                  }}
                  onMouseLeave={() => {
                    setHoveredNode(null)
                    if (onHoverInputIndex) onHoverInputIndex(null)
                  }}
                  onClick={() => handleNodeClick('input', idx)}
                >
                  <title>{`Zone (${node.row + 1},${node.col + 1}): ${Math.round(act * 100)}%`}</title>
                  <text
                    x="76"
                    y={cy + 3.5}
                    textAnchor="end"
                    fill={act > 0.25 ? '#cbd5e1' : '#64748b'}
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                  >
                    {node.row + 1},{node.col + 1}
                  </text>
                  <circle
                    cx="92"
                    cy={cy}
                    r={isFocused ? 10 : 8.5}
                    fill={fill}
                    stroke={isFocused ? '#fbbf24' : act > 0.3 ? '#5eead4' : '#334155'}
                    strokeWidth={isFocused ? 2.5 : 1.5}
                    filter={act > 0.45 ? 'url(#visionNodeGlow)' : undefined}
                  />
                </g>
              )
            })}
          </g>

          {/* Column 2: 12 Hidden Feature-Detector Neurons */}
          <g>
            {hiddenNodes.map((node, idx) => {
              const cy = hiddenY(idx)
              const act = node.activation
              const pct = Math.round(act * 100)
              const isFocused = activeFocus?.layer === 'hidden' && activeFocus.index === idx
              const fill =
                act > 0.08
                  ? `rgba(16, 185, 129, ${(0.2 + act * 0.8).toFixed(2)})`
                  : '#1e293b'
              return (
                <g
                  key={`hid-${node.id}`}
                  className="vision-net-node-hit"
                  onMouseEnter={() => setHoveredNode({ layer: 'hidden', index: idx })}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick('hidden', idx)}
                >
                  <title>{`${node.label}: ${pct}%`}</title>
                  <circle
                    cx="380"
                    cy={cy}
                    r={isFocused ? 14 : 12.5}
                    fill={fill}
                    stroke={isFocused ? '#fbbf24' : act > 0.35 ? '#6ee7b7' : '#475569'}
                    strokeWidth={isFocused ? 2.5 : 1.6}
                    filter={act > 0.45 ? 'url(#visionNodeGlow)' : undefined}
                  />
                  <text
                    x="380"
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill={act > 0.3 ? '#ffffff' : '#94a3b8'}
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    {pct}
                  </text>
                  <rect
                    x="399"
                    y={cy - 10}
                    width="90"
                    height="20"
                    rx="6"
                    fill={isFocused ? '#1e3a8a' : act > 0.45 ? 'rgba(16, 185, 129, 0.22)' : '#1e293b'}
                    stroke={isFocused ? '#fbbf24' : act > 0.45 ? '#34d399' : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    x="444"
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill={act > 0.45 || isFocused ? '#f8fafc' : '#94a3b8'}
                    fontSize="10.5"
                    fontWeight="700"
                  >
                    {node.shortLabel}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Column 3: 10 Output Character Nodes */}
          <g>
            {outputNodes.map((node, idx) => {
              const cy = outputY(idx)
              const pct = Math.round(node.prob * 100)
              const isFocused = activeFocus?.layer === 'output' && activeFocus.index === idx
              const fill = node.isWinner
                ? '#10b981'
                : node.prob > 0.08
                  ? `rgba(14, 165, 233, ${(0.25 + node.prob * 0.75).toFixed(2)})`
                  : '#1e293b'
              return (
                <g
                  key={`out-${node.char}`}
                  className="vision-net-node-hit"
                  onMouseEnter={() => setHoveredNode({ layer: 'output', index: idx })}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick('output', idx)}
                >
                  <title>{`Character "${node.char}": ${pct}%`}</title>
                  {node.isWinner && (
                    <circle
                      cx="758"
                      cy={cy}
                      r="20"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      strokeOpacity="0.85"
                      filter="url(#visionNodeGlow)"
                    />
                  )}
                  <circle
                    cx="758"
                    cy={cy}
                    r={node.isWinner || isFocused ? 16 : 14.5}
                    fill={fill}
                    stroke={isFocused ? '#fbbf24' : node.isWinner ? '#a7f3d0' : '#475569'}
                    strokeWidth={isFocused || node.isWinner ? 2.4 : 1.5}
                    filter={node.isWinner ? 'url(#visionNodeGlow)' : undefined}
                  />
                  <text
                    x="758"
                    y={cy + 5}
                    textAnchor="middle"
                    fill={node.isWinner || node.prob > 0.1 ? '#ffffff' : '#cbd5e1'}
                    fontSize="14"
                    fontWeight="700"
                    fontFamily="var(--font-display)"
                  >
                    {node.char}
                  </text>
                  <text
                    x="784"
                    y={cy + 4}
                    textAnchor="start"
                    fill={node.isWinner ? '#34d399' : '#94a3b8'}
                    fontSize={node.isWinner ? '12.5' : '11'}
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    {pct}%
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Interactive Inspector Caption */}
      <div className="vision-net-inspector" aria-live="polite">
        <span>{inspectorCaption}</span>
        {pinnedNode && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPinnedNode(null)}
          >
            Unpin Neuron
          </button>
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   Main Stage 4 Component: VisionLab
   ========================================================================== */

export default function VisionLab() {
  const { mode, isDeepDive, completedStages, markStageComplete, navigate } = useLearning()
  const stage = getStageById(4)
  const prevStage = STAGES.find((s) => s.id === 3)
  const nextStage = STAGES.find((s) => s.id === 5)
  const isDone = completedStages.has(4)

  const [activeTab, setActiveTab] = useState('filters')

  /* ------------------------------------------------------------------------
     Tab 1 State: Pixel Filters (CNN Edge Explorer)
     ------------------------------------------------------------------------ */
  const [pixelGrid, setPixelGrid] = useState(() => cloneGrid(SAMPLE_GRIDS.smiley.grid))
  const [selectedPresetId, setSelectedPresetId] = useState('smiley')
  const [selectedKernelId, setSelectedKernelId] = useState('verticalEdge')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [showMathBreakdown, setShowMathBreakdown] = useState(false)
  const [scanPos, setScanPos] = useState({ row: 1, col: 1 })
  const [isAutoScanning, setIsAutoScanning] = useState(false)
  const paintModeRef = useRef(null)

  const activeKernel = KERNELS[selectedKernelId] || KERNELS.verticalEdge
  const primaryPresets = useMemo(
    () => [SAMPLE_GRIDS.smiley, SAMPLE_GRIDS.cross, SAMPLE_GRIDS.verticalBar, SAMPLE_GRIDS.letterT],
    [],
  )
  const visibleKernels = useMemo(
    () =>
      showMoreFilters
        ? KERNEL_LIST
        : [KERNELS.verticalEdge, KERNELS.horizontalEdge, KERNELS.corner],
    [showMoreFilters],
  )

  const fullConv = useMemo(
    () => applyFullConvolution(pixelGrid, activeKernel),
    [pixelGrid, activeKernel],
  )

  const activeStep = useMemo(
    () => applyConvolutionStep(pixelGrid, activeKernel, scanPos.row, scanPos.col),
    [pixelGrid, activeKernel, scanPos.row, scanPos.col],
  )

  useEffect(() => {
    if (!isAutoScanning || activeTab !== 'filters') return undefined
    const timer = window.setInterval(() => {
      setScanPos((prev) => {
        const nextIdx = (prev.row * 6 + prev.col + 1) % 36
        return { row: Math.floor(nextIdx / 6), col: nextIdx % 6 }
      })
    }, 420)
    return () => window.clearInterval(timer)
  }, [isAutoScanning, activeTab])

  useEffect(() => {
    const stopPainting = () => {
      paintModeRef.current = null
    }
    window.addEventListener('pointerup', stopPainting)
    return () => window.removeEventListener('pointerup', stopPainting)
  }, [])

  const handlePixelPointerDown = (r, c) => {
    const nextVal = pixelGrid[r][c] > 0 ? 0 : 1
    paintModeRef.current = nextVal
    setSelectedPresetId(null)
    setPixelGrid((prev) => {
      const next = cloneGrid(prev)
      next[r][c] = nextVal
      return next
    })
  }

  const handlePixelPointerEnter = (r, c) => {
    if (paintModeRef.current === null) return
    const targetVal = paintModeRef.current
    setPixelGrid((prev) => {
      if (prev[r][c] === targetVal) return prev
      const next = cloneGrid(prev)
      next[r][c] = targetVal
      return next
    })
  }

  const handleStepDelta = (delta) => {
    setIsAutoScanning(false)
    setScanPos((prev) => {
      const nextIdx = (prev.row * 6 + prev.col + delta + 36) % 36
      return { row: Math.floor(nextIdx / 6), col: nextIdx % 6 }
    })
  }

  /* ------------------------------------------------------------------------
     Tab 2 State: Live Camera Vision (Lazy-loaded TFJS + COCO-SSD)
     ------------------------------------------------------------------------ */
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const modelRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectingRef = useRef(false)

  const [visionStatus, setVisionStatus] = useState('idle') // idle | loading-model | live | photo | error
  const [statusMessage, setStatusMessage] = useState(
    'Click "Start Camera AI", pick a Sample Scene, or upload a photo to run the neural network.',
  )
  const [cameraError, setCameraError] = useState('')
  const [detections, setDetections] = useState([])
  const [isDemoFallback, setIsDemoFallback] = useState(false)
  const [activeSceneId, setActiveSceneId] = useState(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const handleTabChange = useCallback(
    (nextTab) => {
      if (nextTab !== activeTab) {
        playClick()
      }
      if (nextTab !== 'camera') {
        stopCamera()
        setVisionStatus((prev) => (prev === 'live' ? 'idle' : prev))
      }
      setActiveTab(nextTab)
    },
    [activeTab, stopCamera],
  )

  useEffect(() => () => stopCamera(), [stopCamera])

  /* ------------------------------------------------------------------------
     Tab 2 State: Draw Characters (Mousepad Character Recognizer)
     ------------------------------------------------------------------------ */
  const charCanvasRef = useRef(null)
  const charStrokesRef = useRef([])
  const charDrawingRef = useRef(false)
  const digitRecognizer = useMemo(() => createCharRecognizer('digits'), [])
  const letterRecognizer = useMemo(() => createCharRecognizer('letters'), [])

  const [charCharset, setCharCharset] = useState('digits') // 'digits' | 'letters'
  const [strokeCount, setStrokeCount] = useState(0)
  const [charResult, setCharResult] = useState(null)
  const [teachTarget, setTeachTarget] = useState('3')
  const [teachFeedback, setTeachFeedback] = useState('')
  const [customCounts, setCustomCounts] = useState({ digits: 0, letters: 0 })
  const [highlightedZoneIdx, setHighlightedZoneIdx] = useState(null)

  const activeRecognizer = charCharset === 'digits' ? digitRecognizer : letterRecognizer
  const activeCharList = CHARSETS[charCharset] || CHARSETS.digits

  const redrawCharCanvas = useCallback(() => {
    const canvas = charCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const cssSize = 240
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const targetPx = Math.round(cssSize * dpr)
    if (canvas.width !== targetPx || canvas.height !== targetPx) {
      canvas.width = targetPx
      canvas.height = targetPx
    }

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cssSize, cssSize)

    ctx.strokeStyle = '#0f172a'
    ctx.fillStyle = '#0f172a'
    ctx.lineWidth = 15
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const stroke of charStrokesRef.current) {
      if (stroke.length === 0) continue
      if (stroke.length === 1) {
        ctx.beginPath()
        ctx.arc(stroke[0].x, stroke[0].y, 7.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(stroke[0].x, stroke[0].y)
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y)
        }
        ctx.stroke()
      }
    }
    ctx.restore()
  }, [])

  useEffect(() => {
    if (activeTab === 'draw') {
      redrawCharCanvas()
    }
  }, [activeTab, redrawCharCanvas])

  const recognizeCurrentCanvas = useCallback(
    (recognizerOverride, playAudio = true) => {
      const canvas = charCanvasRef.current
      if (!canvas) return null
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const rec = recognizerOverride || activeRecognizer
      const res = rec.recognize(imageData)
      if (!res.hasInk) {
        setCharResult(null)
        return null
      }
      setCharResult(res)
      if (res.prediction) {
        setTeachTarget(res.prediction)
      }
      if (playAudio) {
        playRecognize()
      }
      return res
    },
    [activeRecognizer],
  )

  const getCanvasPoint = (event) => {
    const canvas = charCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = 240 / (rect.width || 240)
    const scaleY = 240 / (rect.height || 240)
    return {
      x: Math.max(0, Math.min(240, (event.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(240, (event.clientY - rect.top) * scaleY)),
    }
  }

  const handleCharPointerDown = (event) => {
    event.preventDefault()
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore if pointer capture is unsupported
      }
    }
    charDrawingRef.current = true
    setTeachFeedback('')
    const pt = getCanvasPoint(event)
    charStrokesRef.current.push([pt])
    setStrokeCount(charStrokesRef.current.length)
    redrawCharCanvas()
  }

  const handleCharPointerMove = (event) => {
    if (!charDrawingRef.current) return
    event.preventDefault()
    const pt = getCanvasPoint(event)
    const currentStroke = charStrokesRef.current[charStrokesRef.current.length - 1]
    if (!currentStroke) return
    const last = currentStroke[currentStroke.length - 1]
    if (Math.hypot(pt.x - last.x, pt.y - last.y) < 2) return
    currentStroke.push(pt)
    redrawCharCanvas()
  }

  const handleCharPointerUp = () => {
    if (!charDrawingRef.current) return
    charDrawingRef.current = false
    recognizeCurrentCanvas(activeRecognizer, true)
  }

  const handleCharClear = () => {
    playClick()
    charStrokesRef.current = []
    setStrokeCount(0)
    setCharResult(null)
    setTeachFeedback('')
    redrawCharCanvas()
  }

  const handleCharUndo = () => {
    if (charStrokesRef.current.length === 0) return
    playClick()
    charStrokesRef.current.pop()
    const nextCount = charStrokesRef.current.length
    setStrokeCount(nextCount)
    setTeachFeedback('')
    redrawCharCanvas()
    if (nextCount > 0) {
      recognizeCurrentCanvas(activeRecognizer, false)
    } else {
      setCharResult(null)
    }
  }

  const handleCharsetSwitch = (nextCharset) => {
    if (nextCharset === charCharset) return
    playClick()
    setCharCharset(nextCharset)
    setTeachFeedback('')
    setTeachTarget(nextCharset === 'digits' ? '3' : 'A')
    const nextRec = nextCharset === 'digits' ? digitRecognizer : letterRecognizer
    if (charStrokesRef.current.length > 0) {
      recognizeCurrentCanvas(nextRec, false)
    } else {
      setCharResult(null)
    }
  }

  const handleTeachHandwriting = () => {
    const canvas = charCanvasRef.current
    if (!canvas || charStrokesRef.current.length === 0) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const taught = activeRecognizer.teach(teachTarget, imageData)
    if (taught.added) {
      playSuccess()
      setCustomCounts((prev) => ({ ...prev, [charCharset]: taught.customCount }))
      setTeachFeedback(`Learned your "${teachTarget}"! Re-testing your drawing now...`)
      recognizeCurrentCanvas(activeRecognizer, false)
    }
  }

  const handleResetCustomHandwriting = () => {
    playClick()
    activeRecognizer.resetCustom()
    setCustomCounts((prev) => ({ ...prev, [charCharset]: 0 }))
    setTeachFeedback('Reset custom handwriting examples.')
    if (charStrokesRef.current.length > 0) {
      recognizeCurrentCanvas(activeRecognizer, false)
    }
  }

  const ensureModelLoaded = useCallback(async () => {
    if (modelRef.current) return modelRef.current
    setVisionStatus('loading-model')
    setStatusMessage('Loading TensorFlow.js & COCO-SSD neural network in your browser...')
    const tf = await import('@tensorflow/tfjs')
    await tf.ready()
    const cocoSsd = await import('@tensorflow-models/coco-ssd')
    const loaded = await cocoSsd.load()
    modelRef.current = loaded
    return loaded
  }, [])

  const runLiveDetectionLoop = useCallback(() => {
    const loop = async () => {
      if (!streamRef.current || !videoRef.current || !canvasRef.current || !modelRef.current) {
        return
      }
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video.readyState >= 2 && !detectingRef.current) {
        detectingRef.current = true
        try {
          const vw = video.videoWidth || 640
          const vh = video.videoHeight || 480
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw
            canvas.height = vh
          }
          const ctx = canvas.getContext('2d')
          const preds = await modelRef.current.detect(video)
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            drawBoundingBoxes(ctx, preds, canvas.width, canvas.height, vw, vh)
          }
          setDetections(preds)
          setIsDemoFallback(false)
        } catch {
          // Ignore transient frame errors while stopping
        } finally {
          detectingRef.current = false
        }
      }
      rafRef.current = window.requestAnimationFrame(loop)
    }
    rafRef.current = window.requestAnimationFrame(loop)
  }, [])

  const handleStartCamera = async () => {
    setCameraError('')
    setActiveSceneId(null)
    setIsDemoFallback(false)
    stopCamera()

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('No webcam detected in this browser — try a Sample Scene or Upload a Photo!')
      setVisionStatus('idle')
      return
    }

    try {
      const model = await ensureModelLoaded()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (model) {
        setVisionStatus('live')
        setStatusMessage('Live neural network running locally on your device — zero data leaves your browser!')
        runLiveDetectionLoop()
      }
    } catch (err) {
      stopCamera()
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied — no problem! Try a Sample Scene or Upload a Photo below.'
          : 'Camera unavailable on this device — try a Sample Scene or Upload a Photo below!'
      setCameraError(msg)
      setVisionStatus('idle')
    }
  }

  const handleAnalyzeSampleScene = async (scene) => {
    stopCamera()
    setCameraError('')
    setActiveSceneId(scene.id)

    const canvas = canvasRef.current
    if (!canvas) return
    drawSampleScene(canvas, scene.id)

    try {
      const model = await ensureModelLoaded()
      const preds = await model.detect(canvas)
      const ctx = canvas.getContext('2d')
      drawSampleScene(canvas, scene.id)
      if (preds.length > 0) {
        if (ctx) drawBoundingBoxes(ctx, preds, canvas.width, canvas.height, canvas.width, canvas.height)
        setDetections(preds)
        setIsDemoFallback(false)
        setVisionStatus('photo')
        setStatusMessage(`COCO-SSD detected ${preds.length} object(s) in "${scene.label}"!`)
      } else {
        // Synthetic flat illustration may not trigger photo-trained COCO-SSD; show annotated demo preview
        if (ctx) {
          drawBoundingBoxes(
            ctx,
            scene.fallbackDetections,
            canvas.width,
            canvas.height,
            canvas.width,
            canvas.height,
          )
        }
        setDetections(scene.fallbackDetections)
        setIsDemoFallback(true)
        setVisionStatus('photo')
        setStatusMessage(
          `COCO-SSD ran on "${scene.label}" (showing illustrative bounding boxes — upload a real photo or use webcam for live photographic detection!).`,
        )
      }
    } catch {
      const ctx = canvas.getContext('2d')
      drawSampleScene(canvas, scene.id)
      if (ctx) {
        drawBoundingBoxes(
          ctx,
          scene.fallbackDetections,
          canvas.width,
          canvas.height,
          canvas.width,
          canvas.height,
        )
      }
      setDetections(scene.fallbackDetections)
      setIsDemoFallback(true)
      setVisionStatus('photo')
      setStatusMessage(
        'Offline preview mode: showing simulated bounding boxes (connect online to download COCO-SSD weights).',
      )
    }
  }

  const handleUploadPhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    stopCamera()
    setCameraError('')
    setActiveSceneId(null)

    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = async () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const maxW = 640
        const scale = Math.min(1, maxW / img.width)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        try {
          const model = await ensureModelLoaded()
          const preds = await model.detect(img)
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            drawBoundingBoxes(ctx, preds, canvas.width, canvas.height, img.width, img.height)
          }
          setDetections(preds)
          setIsDemoFallback(false)
          setVisionStatus('photo')
          setStatusMessage(
            preds.length > 0
              ? `COCO-SSD found ${preds.length} object(s) in your photo!`
              : 'COCO-SSD ran on your photo but found no confident objects (try a clearer photo of everyday items!).',
          )
        } catch {
          setDetections([])
          setVisionStatus('error')
          setStatusMessage('Could not load the COCO-SSD model right now. Check your connection and try again.')
        }
      }
      if (typeof reader.result === 'string') {
        img.src = reader.result
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  /* ------------------------------------------------------------------------
     Tab 3 State: Teach a Mini-Brain (2-Class Classifier)
     ------------------------------------------------------------------------ */
  const [drawGrid, setDrawGrid] = useState(() => createBlankGrid(8))
  const [classAName, setClassAName] = useState('⭐ Star')
  const [classBName, setClassBName] = useState('😀 Face')
  const [examplesA, setExamplesA] = useState([])
  const [examplesB, setExamplesB] = useState([])
  const [liveClassify, setLiveClassify] = useState(true)
  const [manualResult, setManualResult] = useState(null)
  const trainerPaintRef = useRef(null)

  useEffect(() => {
    const stopTrainerPaint = () => {
      trainerPaintRef.current = null
    }
    window.addEventListener('pointerup', stopTrainerPaint)
    return () => window.removeEventListener('pointerup', stopTrainerPaint)
  }, [])

  const livePrediction = useMemo(() => {
    if (!liveClassify) return manualResult
    return classifyMiniBrain(drawGrid, examplesA, examplesB)
  }, [liveClassify, manualResult, drawGrid, examplesA, examplesB])

  const handleTrainerPointerDown = (r, c) => {
    const nextVal = drawGrid[r][c] > 0 ? 0 : 1
    trainerPaintRef.current = nextVal
    setDrawGrid((prev) => {
      const next = cloneGrid(prev)
      next[r][c] = nextVal
      return next
    })
  }

  const handleTrainerPointerEnter = (r, c) => {
    if (trainerPaintRef.current === null) return
    const targetVal = trainerPaintRef.current
    setDrawGrid((prev) => {
      if (prev[r][c] === targetVal) return prev
      const next = cloneGrid(prev)
      next[r][c] = targetVal
      return next
    })
  }

  const hasDrawnPixels = useMemo(() => drawGrid.some((row) => row.some((v) => v > 0)), [drawGrid])

  const handleAddExample = (targetClass) => {
    if (!hasDrawnPixels) return
    playClick()
    const snapshot = cloneGrid(drawGrid)
    if (targetClass === 'A') {
      setExamplesA((prev) => [...prev, snapshot])
    } else {
      setExamplesB((prev) => [...prev, snapshot])
    }
    setDrawGrid(createBlankGrid(8))
    setManualResult(null)
  }

  const handleLoadDemoExamples = () => {
    playSuccess()
    setClassAName('⭐ Star')
    setClassBName('😀 Face')
    setExamplesA(DEMO_TRAINING_EXAMPLES.classA.map(cloneGrid))
    setExamplesB(DEMO_TRAINING_EXAMPLES.classB.map(cloneGrid))
    setDrawGrid(cloneGrid(SAMPLE_GRIDS.smiley.grid))
    setManualResult(null)
  }

  const handleManualTest = () => {
    const res = classifyMiniBrain(drawGrid, examplesA, examplesB)
    setManualResult(res)
    if (res) playRecognize()
  }

  const handleMarkComplete = async () => {
    playSuccess()
    markStageComplete(4)
    try {
      const confettiMod = await import('canvas-confetti')
      const confetti = confettiMod.default || confettiMod
      if (typeof confetti === 'function') {
        confetti({ particleCount: 55, spread: 60, origin: { y: 0.7 } })
      }
    } catch {
      // Confetti is purely decorative
    }
  }

  const pipelineSteps = [
    {
      num: 'STEP 1',
      title: 'RGB Pixels',
      kid: 'Every photo becomes a giant grid of Red, Green, and Blue numbers.',
      deep: 'Input image is resized into a 3-channel H×W×3 tensor normalized to [0, 1].',
    },
    {
      num: 'STEP 2',
      title: 'Edge Filters',
      kid: 'Early layers slide 3×3 filters (just like Tab 1!) to spot lines and corners.',
      deep: 'Depthwise-separable Conv2D layers extract low-level spatial gradients.',
    },
    {
      num: 'STEP 3',
      title: 'Shapes & Textures',
      kid: 'Deeper layers combine edges into wheels, screens, handles, and faces.',
      deep: 'Feature pyramid maps aggregate hierarchical mid- and high-level motifs.',
    },
    {
      num: 'STEP 4',
      title: 'Object Probabilities',
      kid:
        detections.length > 0
          ? `Top guess: ${detections[0].class} (${Math.round(detections[0].score * 100)}%)!`
          : 'Final layer draws boxes and outputs confidence scores for 80 objects.',
      deep:
        detections.length > 0
          ? `SSD heads + NMS yielded ${detections.length} box(es); top=${detections[0].class} (p=${detections[0].score.toFixed(2)}).`
          : 'Single Shot MultiBox Detector regresses bounding boxes + softmax class logits.',
    },
  ]

  return (
    <div className="lab-page" style={{ '--stage-accent': stage?.color || '#10b981' }}>
      {/* Stage Header */}
      <header className="lab-header">
        <div>
          <div className="stage-card-badges">
            <span
              className="badge"
              style={{
                background: '#10b9811a',
                color: '#047857',
                border: '1px solid #10b98144',
              }}
            >
              Stage 4 · {stage?.level || 'Explorer'}
            </span>
            <span className="badge badge-subtle">{stage?.ageBadge || 'Ages 10+'}</span>
            <span className={`badge ${isDeepDive ? 'badge-deep' : 'badge-explorer'}`}>
              {isDeepDive ? 'Deep-Dive Mode' : 'Explorer Mode'}
            </span>
            {isDone && (
              <span className="badge badge-success">
                <CheckCircle2 size={13} />
                Completed
              </span>
            )}
          </div>
          <h1>{stage?.title || 'How Computers See'}</h1>
          <p className="stage-card-subtitle">
            {stage?.subtitle || 'Spot edges with pixel filters, live AI vision, and your own mini-brain'}
          </p>
        </div>

        <button
          type="button"
          className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
          onClick={handleMarkComplete}
        >
          <CheckCircle2 size={16} />
          <span>{isDone ? 'Stage 4 Completed' : 'Mark Stage 4 Complete'}</span>
        </button>
      </header>

      {/* Mode-Adaptive Intro Callout */}
      <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
        <strong>{isDeepDive ? 'Deep-Dive Vision Lab: ' : 'How do computers see? '}</strong>
        {isDeepDive
          ? 'Convolutional Neural Networks (CNNs) replace hand-crafted rules with learned 2D spatial filters. Inspect exact 3×3 discrete convolution math, run a MobileNet-backed COCO-SSD detector in WebGL/CPU, and train a feature-space classifier.'
          : 'Computers don’t have eyes—they only see grids of numbers! First slide a magic 3×3 pattern filter over pixel art, then test a real object-detecting AI, and finally teach your own mini-brain to recognize your drawings!'}
      </div>

      {/* 4-Tab Switcher */}
      <div className="vision-lab-tabs" role="tablist" aria-label="Vision Lab Modules">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'filters'}
          className={`vision-tab-btn ${activeTab === 'filters' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('filters')}
        >
          <Grid3X3 size={18} />
          <span>1. Pixel Filters</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'draw'}
          className={`vision-tab-btn is-featured ${activeTab === 'draw' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('draw')}
        >
          <PenTool size={18} />
          <span>2. Draw Characters ✨</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'camera'}
          className={`vision-tab-btn ${activeTab === 'camera' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('camera')}
        >
          <Camera size={18} />
          <span>3. Live Camera AI</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'trainer'}
          className={`vision-tab-btn ${activeTab === 'trainer' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('trainer')}
        >
          <Brain size={18} />
          <span>4. Teach a Mini-Brain</span>
        </button>
      </div>

      {/* ====================================================================
          TAB 1: PIXEL FILTERS (CNN EDGE EXPLORER)
          ==================================================================== */}
      {activeTab === 'filters' && (
        <section className="lab-card" aria-label="Pixel Filters CNN Explorer">
          <div className="vision-section-header">
            <div>
              <h2>Spot Shapes with a 3×3 Magnifying Glass</h2>
              <p>
                A filter is a tiny 3×3 magnifying glass that scans for ONE shape. Wherever your
                drawing matches the magnifying glass, the output glows bright!
              </p>
            </div>
            <div className="vision-scan-controls">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleStepDelta(-1)}
                aria-label="Previous filter position"
              >
                <SkipBack size={15} />
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isAutoScanning ? 'btn-success' : 'btn-primary'}`}
                onClick={() => setIsAutoScanning((prev) => !prev)}
              >
                {isAutoScanning ? <Pause size={15} /> : <Play size={15} />}
                <span>{isAutoScanning ? 'Pause Scan' : 'Auto-Scan'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleStepDelta(1)}
                aria-label="Next filter position"
              >
                <SkipForward size={15} />
              </button>
            </div>
          </div>

          {/* Visual Filter Selector Cards (3 clear defaults + More Filters toggle) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Choose what to search for:{' '}
              <span style={{ color: '#059669' }}>■ Green = wants ink</span> ·{' '}
              <span style={{ color: '#e11d48' }}>■ Pink = wants empty</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                playClick()
                setShowMoreFilters((prev) => !prev)
              }}
            >
              {showMoreFilters ? 'Show Fewer Filters' : 'More Filters (Sharpen, Blur)'}
            </button>
          </div>

          <div className="vision-kernel-cards" role="group" aria-label="Convolution filter kernels">
            {visibleKernels.map((kernel) => {
              const selected = kernel.id === selectedKernelId
              const shortTitle =
                kernel.id === 'verticalEdge'
                  ? 'Vertical Line |'
                  : kernel.id === 'horizontalEdge'
                    ? 'Horizontal Line —'
                    : kernel.id === 'corner'
                      ? 'Corner ⌜'
                      : kernel.name
              return (
                <button
                  key={kernel.id}
                  type="button"
                  aria-pressed={selected}
                  className={`vision-kernel-card ${selected ? 'is-selected' : ''}`}
                  onClick={() => {
                    playClick()
                    setSelectedKernelId(kernel.id)
                  }}
                >
                  <div className="vision-kernel-card-row">
                    <div className="vision-pattern-icon" aria-hidden="true">
                      {kernel.weights.flat().map((w, idx) => (
                        <span
                          key={idx}
                          className={`vision-pattern-dot ${w > 0 ? 'is-pos' : w < 0 ? 'is-neg' : ''}`}
                        />
                      ))}
                    </div>
                    <div>
                      <div className="vision-kernel-card-head">{shortTitle}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {isDeepDive ? kernel.name : kernel.kidName}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Preset Pixel Art Buttons */}
          <div className="vision-preset-bar">
            {primaryPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`vision-preset-btn ${selectedPresetId === preset.id ? 'is-selected' : ''}`}
                onClick={() => {
                  playClick()
                  setPixelGrid(cloneGrid(preset.grid))
                  setSelectedPresetId(preset.id)
                }}
              >
                <span>{preset.emoji}</span>
                <span>{preset.name}</span>
              </button>
            ))}
            <button
              type="button"
              className="vision-preset-btn"
              onClick={() => {
                playClick()
                setPixelGrid(createBlankGrid(8))
                setSelectedPresetId(null)
              }}
            >
              <Eraser size={14} />
              <span>Clear</span>
            </button>
          </div>

          {/* Clean 2-Column Interactive Workspace */}
          <div className="vision-cnn-workspace">
            {/* Column 1: 8x8 Drawing Grid (clean squares, no 0/1 clutter) */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>1. Your Drawing (8×8)</span>
                <span className="badge badge-subtle">Click or Drag</span>
              </div>
              <div className="vision-pixel-grid-wrap">
                <div className="vision-pixel-grid" role="grid" aria-label="8 by 8 drawable pixel grid">
                  {pixelGrid.map((rowArr, r) =>
                    rowArr.map((val, c) => {
                      const inSpotlight =
                        r >= scanPos.row &&
                        r < scanPos.row + 3 &&
                        c >= scanPos.col &&
                        c < scanPos.col + 3
                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          aria-label={`Pixel row ${r + 1} column ${c + 1}, ${val ? 'ink' : 'empty'}`}
                          className={`vision-pixel-cell ${val > 0 ? 'is-on' : ''} ${inSpotlight ? 'in-spotlight' : ''}`}
                          onPointerDown={() => handlePixelPointerDown(r, c)}
                          onPointerEnter={() => handlePixelPointerEnter(r, c)}
                        />
                      )
                    }),
                  )}
                </div>
                <div
                  className="vision-spotlight-frame"
                  aria-hidden="true"
                  style={{
                    top: `calc(${(scanPos.row / 8) * 100}% + 2px)`,
                    left: `calc(${(scanPos.col / 8) * 100}% + 2px)`,
                    width: 'calc(37.5% - 4px)',
                    height: 'calc(37.5% - 4px)',
                  }}
                />
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Orange box = 3×3 magnifying glass at row {scanPos.row + 1}, col {scanPos.col + 1}
              </p>
            </div>

            {/* Column 2: 6x6 Glowing Match Heatmap */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>2. What the Filter Found (6×6)</span>
                <span className="badge badge-subtle">Click any square</span>
              </div>
              <div className="vision-feature-grid" role="grid" aria-label="6 by 6 output feature map">
                {fullConv.featureMap.map((rowArr, r) =>
                  rowArr.map((val, c) => {
                    const isActive = r === scanPos.row && c === scanPos.col
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        aria-label={`Filter match row ${r + 1} col ${c + 1}, score ${formatNumber(val)}`}
                        className={`vision-feature-cell ${isActive ? 'is-active' : ''}`}
                        style={getFeatureCellStyle(val, fullConv.maxAbs)}
                        onClick={() => {
                          setIsAutoScanning(false)
                          setScanPos({ row: r, col: c })
                        }}
                      />
                    )
                  }),
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                <strong style={{ color: '#059669' }}>Bright green</strong> = strong pattern match ·{' '}
                <strong>Dark</strong> = no match
              </p>
            </div>
          </div>

          {/* Plain-English Magnifying-Glass Verdict Bar */}
          <div className="vision-verdict-bar" aria-live="polite">
            <div className="vision-verdict-text">
              <span style={{ color: '#fbbf24', marginRight: 6 }}>🔍 Magnifying Glass:</span>
              {getFilterVerdict(activeKernel.id, activeStep.value)}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-expanded={showMathBreakdown}
              onClick={() => {
                playClick()
                setShowMathBreakdown((prev) => !prev)
              }}
            >
              {showMathBreakdown ? 'Hide 3×3 Math Breakdown' : 'Show 3×3 Math Breakdown'}
            </button>
          </div>

          {/* Collapsible 3x3 Math Breakdown */}
          {showMathBreakdown && (
            <div className="vision-math-collapse">
              <div className="vision-panel-title">
                <span>3×3 Multiply & Sum Breakdown ({activeKernel.name})</span>
                <span className="badge badge-subtle">
                  Row {scanPos.row + 1}, Col {scanPos.col + 1}
                </span>
              </div>

              <div className="vision-math-strip">
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
                    3×3 Patch
                  </div>
                  <div className="vision-math-matrix">
                    {activeStep.patch.flat().map((p, i) => (
                      <div key={i} className={`vision-math-cell ${p > 0 ? 'is-pixel-on' : ''}`}>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>

                <span className="vision-math-op">×</span>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
                    Kernel
                  </div>
                  <div className="vision-math-matrix">
                    {activeStep.kernel.flat().map((w, i) => (
                      <div
                        key={i}
                        className={`vision-math-cell ${w > 0 ? 'is-pos' : w < 0 ? 'is-neg' : ''}`}
                      >
                        {formatKernelWeight(w)}
                      </div>
                    ))}
                  </div>
                </div>

                <span className="vision-math-op">=</span>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
                    Products
                  </div>
                  <div className="vision-math-matrix">
                    {activeStep.products.flat().map((prod, i) => (
                      <div
                        key={i}
                        className={`vision-math-cell ${prod > 0 ? 'is-pos' : prod < 0 ? 'is-neg' : ''}`}
                      >
                        {formatNumber(prod)}
                      </div>
                    ))}
                  </div>
                </div>

                <span className="vision-math-op">→</span>

                <div className="vision-math-result">
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sum</div>
                  <div className="vision-math-result-val">{formatNumber(activeStep.value)}</div>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {isDeepDive ? activeKernel.deepDive : activeKernel.description}
              </p>
            </div>
          )}
        </section>
      )}

      {/* ====================================================================
          TAB 2: DRAW CHARACTERS (MOUSEPAD CHARACTER RECOGNIZER)
          ==================================================================== */}
      {activeTab === 'draw' && (
        <section className="lab-card" aria-label="Draw Characters Recognizer">
          <div className="vision-section-header">
            <div>
              <h2>Draw Characters with Your Mouse or Trackpad</h2>
              <p>
                {isDeepDive
                  ? 'Draw any digit or uppercase letter. The engine crops the ink bounding box, centers it by center-of-mass onto a 16×16 (256-pixel) grid, extracts blurred intensity + directional HOG gradients, and computes cosine-similarity softmax probabilities.'
                  : 'Draw a big bold number or letter on the pad and watch the AI shrink, center, and recognize your handwriting in real time!'}
              </p>
            </div>

            <div className="vision-charset-toggle" role="group" aria-label="Character set">
              <button
                type="button"
                aria-pressed={charCharset === 'digits'}
                className={`vision-charset-btn ${charCharset === 'digits' ? 'is-active' : ''}`}
                onClick={() => handleCharsetSwitch('digits')}
              >
                Digits (0–9)
              </button>
              <button
                type="button"
                aria-pressed={charCharset === 'letters'}
                className={`vision-charset-btn ${charCharset === 'letters' ? 'is-active' : ''}`}
                onClick={() => handleCharsetSwitch('letters')}
              >
                Letters (A–Z)
              </button>
            </div>
          </div>

          <div className="vision-char-workspace">
            {/* Column 1: Smooth High-DPI Drawing Pad */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>1. Draw Here</span>
                <span className="badge badge-subtle">
                  {charCharset === 'digits' ? '0 – 9' : 'A – Z'}
                </span>
              </div>

              <div className="vision-draw-canvas-wrap">
                <canvas
                  ref={charCanvasRef}
                  className="vision-draw-canvas"
                  aria-label="Character drawing pad"
                  onPointerDown={handleCharPointerDown}
                  onPointerMove={handleCharPointerMove}
                  onPointerUp={handleCharPointerUp}
                  onPointerCancel={handleCharPointerUp}
                />
                {strokeCount === 0 && (
                  <div className="vision-draw-hint">
                    <PenTool size={22} color="#10b981" />
                    <span>
                      {charCharset === 'digits'
                        ? 'Try drawing a big bold 3, 7, or 8!'
                        : 'Try drawing a big bold A, M, or S!'}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={strokeCount === 0}
                  onClick={() => recognizeCurrentCanvas(activeRecognizer, true)}
                >
                  <Sparkles size={15} />
                  <span>Recognize</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={strokeCount === 0}
                  onClick={handleCharUndo}
                >
                  <Undo2 size={15} />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={strokeCount === 0}
                  onClick={handleCharClear}
                >
                  <Eraser size={15} />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Column 2: Step 2 (16x16 Crop & Center) -> Step 3 (4x4 Pooled Zones) */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>2 & 3. Center (16×16) → Pool (4×4)</span>
                <span className="badge badge-subtle">16 Inputs</span>
              </div>

              <div className="vision-pool-flow">
                {/* Step 2: 16x16 Grid with 4x4 dashed zone divider overlay */}
                <div className="vision-pool-step">
                  <span className="vision-pool-step-label">Step 2: 16×16 (256 px)</span>
                  <div className="vision-centered-grid-wrap">
                    <div
                      className="vision-centered-grid"
                      aria-label="16 by 16 centered neural network input with 4 by 4 zone dividers"
                    >
                      {(charResult?.normalizedGrid ||
                        Array.from({ length: 16 }, () => new Array(16).fill(0))
                      ).map((rowArr, r) =>
                        rowArr.map((val, c) => {
                          const bg =
                            val > 0.04
                              ? `rgb(${Math.round(16 + val * 36)}, ${Math.round(40 + val * 190)}, ${Math.round(60 + val * 105)})`
                              : '#0f172a'
                          return (
                            <div
                              key={`c16-${r}-${c}`}
                              className="vision-centered-cell"
                              style={{ backgroundColor: bg }}
                            />
                          )
                        }),
                      )}
                    </div>
                    <div className="vision-zone-overlay" aria-label="16 zone overlay on 16 by 16 grid">
                      {Array.from({ length: 16 }, (_, zIdx) => {
                        const zr = Math.floor(zIdx / 4)
                        const zc = zIdx % 4
                        return (
                          <button
                            key={`zb-${zIdx}`}
                            type="button"
                            aria-label={`Zone row ${zr + 1} col ${zc + 1} on 16 by 16 grid`}
                            className={`vision-zone-box ${highlightedZoneIdx === zIdx ? 'is-highlighted' : ''}`}
                            onMouseEnter={() => setHighlightedZoneIdx(zIdx)}
                            onMouseLeave={() => setHighlightedZoneIdx(null)}
                            onClick={() => {
                              playClick()
                              setHighlightedZoneIdx((prev) => (prev === zIdx ? null : zIdx))
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Explicit Pooling Arrow */}
                <div className="vision-pool-arrow" aria-hidden="true">
                  <ArrowRight size={18} />
                  <span>avg each</span>
                  <span>4×4 block</span>
                </div>

                {/* Step 3: 4x4 Pooled Zones (16 Input Nodes) */}
                <div className="vision-pool-step">
                  <span className="vision-pool-step-label">Step 3: 4×4 (16 Inputs)</span>
                  <div className="vision-pooled-grid" aria-label="4 by 4 pooled zone grid feeding 16 input nodes">
                    {(
                      charResult?.networkTrace?.inputNodes ||
                      Array.from({ length: 16 }, (_, idx) => ({
                        id: idx,
                        row: Math.floor(idx / 4),
                        col: idx % 4,
                        activation: 0,
                      }))
                    ).map((node) => {
                      const pct = Math.round(node.activation * 100)
                      const bg =
                        node.activation > 0.04
                          ? `rgba(16, 185, 129, ${(0.22 + node.activation * 0.78).toFixed(2)})`
                          : '#1e293b'
                      return (
                        <button
                          key={`pool-${node.id}`}
                          type="button"
                          aria-label={`Pooled zone ${node.row + 1},${node.col + 1}: ${pct}% brightness`}
                          className={`vision-pooled-cell ${highlightedZoneIdx === node.id ? 'is-highlighted' : ''}`}
                          style={{
                            backgroundColor: bg,
                            color: node.activation > 0.35 ? '#ffffff' : '#94a3b8',
                          }}
                          onMouseEnter={() => setHighlightedZoneIdx(node.id)}
                          onMouseLeave={() => setHighlightedZoneIdx(null)}
                          onClick={() => {
                            playClick()
                            setHighlightedZoneIdx((prev) => (prev === node.id ? null : node.id))
                          }}
                        >
                          <span style={{ opacity: 0.75, fontSize: '0.52rem' }}>
                            {node.row + 1},{node.col + 1}
                          </span>
                          <span>{pct}%</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {isDeepDive
                  ? '16×16 normalized ink → 4×4 average pooling → 16 input neurons below. Hover any zone to trace its exact block & synapses!'
                  : 'We average each dashed 4×4 square into 1 brightness number. Hover any square to highlight its matching neuron below!'}
              </p>
            </div>

            {/* Column 3: Predicted Character, Top-5 Probabilities & Teach Row */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>3. AI Prediction</span>
                {customCounts[charCharset] > 0 && (
                  <span className="badge badge-success">
                    +{customCounts[charCharset]} taught
                  </span>
                )}
              </div>

              {!charResult ? (
                <div
                  style={{
                    padding: '22px 14px',
                    textAlign: 'center',
                    fontSize: '0.88rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-strong)',
                  }}
                >
                  Draw a {charCharset === 'digits' ? 'digit (0–9)' : 'letter (A–Z)'} on the left — recognition runs automatically as soon as you lift your finger or mouse!
                </div>
              ) : (
                <>
                  <div className="vision-char-prediction-hero" aria-live="polite">
                    <div className="vision-char-big-glyph">{charResult.prediction}</div>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                        Best Guess
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700 }}>
                        Looks like &ldquo;{charResult.prediction}&rdquo;
                      </div>
                      <span
                        className="badge"
                        style={{
                          marginTop: 4,
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#6ee7b7',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                        }}
                      >
                        {Math.round(charResult.confidence * 100)}% confident
                      </span>
                    </div>
                  </div>

                  {/* Top-5 Animated Probability Bars */}
                  <div className="vision-topk-list" aria-label="Top 5 character probabilities">
                    {charResult.topK.map((item, idx) => {
                      const pct = Math.round(item.prob * 100)
                      return (
                        <div key={item.char} className={`vision-topk-row ${idx === 0 ? 'is-top' : ''}`}>
                          <span className="vision-topk-glyph">{item.char}</span>
                          <div className="vision-conf-track">
                            <div
                              className="vision-conf-fill"
                              style={{
                                width: `${pct}%`,
                                background: idx === 0 ? '#10b981' : '#64748b',
                              }}
                            />
                          </div>
                          <span className="font-mono" style={{ textAlign: 'right', color: idx === 0 ? '#059669' : 'var(--text-secondary)' }}>
                            {pct}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Teach My Handwriting Correction Row */}
              <div className="vision-teach-row">
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Teach My Handwriting:
                </span>
                <select
                  className="vision-teach-select"
                  aria-label="Select true character to teach"
                  value={teachTarget}
                  onChange={(e) => setTeachTarget(e.target.value)}
                >
                  {activeCharList.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={strokeCount === 0}
                  onClick={handleTeachHandwriting}
                >
                  <Plus size={14} />
                  <span>Teach</span>
                </button>
                {customCounts[charCharset] > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleResetCustomHandwriting}
                  >
                    Reset Custom
                  </button>
                )}
              </div>

              {teachFeedback && (
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#047857' }} role="status">
                  {teachFeedback}
                </p>
              )}
            </div>
          </div>

          <LiveCharNetworkDiagram
            networkTrace={charResult?.networkTrace || null}
            isDeepDive={isDeepDive}
            highlightedInputIndex={highlightedZoneIdx}
            onHoverInputIndex={setHighlightedZoneIdx}
          />

          <div className={isDeepDive ? 'callout-deep' : 'callout-kid'} style={{ marginTop: 18 }}>
            <strong>{isDeepDive ? 'How MNIST-Style Recognition Works: ' : 'How did it read my handwriting? '}</strong>
            {isDeepDive
              ? 'Raw canvas strokes are cropped to their tight bounding box, aspect-scaled into a 12×12 box centered by center-of-mass inside a 16×16 grid (256 pixels). Multi-orientation gradient histograms (HOG) + smoothed intensities are compared via cosine similarity and converted to probabilities with softmax—and "Teach" adds your own prototype directly to the classifier.'
              : 'First the AI trims away empty space and centers your stroke inside a 16×16 pixel grid. Then it checks which way your lines curve and slant, scores every character, and picks the highest probability! If it misses your unique style, click "Teach" and it learns immediately.'}
          </div>
        </section>
      )}

      {/* ====================================================================
          TAB 2: LIVE CAMERA VISION (REAL BROWSER NEURAL NET)
          ==================================================================== */}
      {activeTab === 'camera' && (
        <section className="lab-card" aria-label="Live Camera AI Object Detector">
          <div className="vision-section-header">
            <div>
              <h2>Real Browser Object Detector (COCO-SSD)</h2>
              <p>
                {isDeepDive
                  ? 'Runs a pretrained MobileNetV2-SSD object detector locally via TensorFlow.js. Model weights are lazy-loaded only when you activate detection.'
                  : 'Point your camera at everyday objects—or try a built-in scene or upload a photo—and watch a real neural network spot what it sees!'}
              </p>
            </div>
            <span
              className={`vision-status-badge ${
                visionStatus === 'live' || visionStatus === 'photo'
                  ? 'is-ready'
                  : visionStatus === 'loading-model'
                    ? 'is-loading'
                    : 'is-warn'
              }`}
            >
              <Eye size={14} />
              <span>
                {visionStatus === 'live'
                  ? 'Live Webcam AI Active'
                  : visionStatus === 'loading-model'
                    ? 'Loading Neural Net...'
                    : visionStatus === 'photo'
                      ? 'Image Analyzed'
                      : 'Ready (Model Lazy-Loaded)'}
              </span>
            </span>
          </div>

          {/* Action Toolbar */}
          <div className="vision-camera-toolbar">
            {visionStatus === 'live' ? (
              <button type="button" className="btn btn-secondary" onClick={() => { stopCamera(); setVisionStatus('idle') }}>
                <CameraOff size={16} />
                <span>Stop Camera</span>
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleStartCamera}>
                <Camera size={16} />
                <span>Start Camera AI</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleAnalyzeSampleScene(SAMPLE_SCENES[0])}
            >
              <ImageIcon size={16} />
              <span>Analyze Sample Photo</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              <span>Upload Your Photo</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadPhoto}
              style={{ display: 'none' }}
              aria-label="Upload an image for object detection"
            />
          </div>

          {cameraError && (
            <div
              className="vision-status-badge is-warn"
              role="status"
              style={{ marginBottom: 14, borderRadius: 'var(--radius-md)', padding: '10px 14px', width: '100%' }}
            >
              <CameraOff size={16} />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Viewport + Detections Sidebar */}
          <div className="vision-stage-grid">
            <div>
              <div className="vision-viewport">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ display: visionStatus === 'live' ? 'block' : 'none' }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    display: visionStatus === 'live' || visionStatus === 'photo' ? 'block' : 'none',
                  }}
                />
                {visionStatus !== 'live' && visionStatus !== 'photo' && (
                  <div className="vision-viewport-placeholder">
                    <Camera size={40} color="#34d399" />
                    <p style={{ fontWeight: 700, color: '#f8fafc' }}>
                      {visionStatus === 'loading-model'
                        ? 'Downloading COCO-SSD weights...'
                        : 'No camera needed to explore!'}
                    </p>
                    <p style={{ fontSize: '0.86rem' }}>{statusMessage}</p>
                  </div>
                )}
              </div>

              {/* 3 Built-In Camera-Free Sample Scenes */}
              <div className="vision-sample-scenes" aria-label="Built-in sample scenes">
                {SAMPLE_SCENES.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={`vision-scene-btn ${activeSceneId === scene.id ? 'is-active' : ''}`}
                    onClick={() => handleAnalyzeSampleScene(scene)}
                  >
                    <span style={{ fontSize: '1.35rem' }}>{scene.emoji}</span>
                    <span>{scene.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Panel: Detected Objects & Confidence Bars */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>Detected Objects</span>
                <span className="badge badge-subtle">
                  {detections.length} found{isDemoFallback ? ' · Demo' : ''}
                </span>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{statusMessage}</p>

              {detections.length === 0 ? (
                <div
                  style={{
                    padding: '18px 12px',
                    textAlign: 'center',
                    fontSize: '0.86rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-strong)',
                  }}
                >
                  Waiting for detections... Hold up a cup, phone, book, or click a Sample Scene!
                </div>
              ) : (
                <div className="vision-detection-list">
                  {detections.map((det, idx) => {
                    const pct = Math.round(det.score * 100)
                    return (
                      <div key={`${det.class}-${idx}`} className="vision-detection-item">
                        <div className="vision-detection-top">
                          <span>{det.class}</span>
                          <span className="font-mono" style={{ color: '#059669' }}>
                            {pct}%
                          </span>
                        </div>
                        <div className="vision-conf-track">
                          <div
                            className="vision-conf-fill"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 75 ? '#10b981' : '#f59e0b',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 4-Step Visual Pipeline Strip */}
          <div style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: 4 }}>How the AI Recognized That</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {mode === 'deep-dive'
                ? 'Inside a convolutional object detector (MobileNet + SSD):'
                : 'Follow the 4-step journey from raw pixels to a smart guess:'}
            </p>
            <div className="vision-pipeline-strip">
              {pipelineSteps.map((step, idx) => (
                <div
                  key={step.num}
                  className={`vision-pipeline-step ${detections.length > 0 || idx === 0 ? 'is-lit' : ''}`}
                >
                  <span className="vision-pipeline-num">{step.num}</span>
                  <span className="vision-pipeline-title">{step.title}</span>
                  <span className="vision-pipeline-desc">{isDeepDive ? step.deep : step.kid}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          TAB 3: TEACH A MINI-BRAIN (INTERACTIVE 2-CLASS CLASSIFIER)
          ==================================================================== */}
      {activeTab === 'trainer' && (
        <section className="lab-card" aria-label="Teach a Mini-Brain 2-Class Classifier">
          <div className="vision-section-header">
            <div>
              <h2>Teach Your Own Mini-Brain</h2>
              <p>
                {isDeepDive
                  ? 'Collect labeled 8×8 sketches. Each drawing is encoded into a 152-D feature vector (raw pixels + 4×4 spatial pooling + Sobel edge maps) and classified via blended nearest-centroid cosine similarity & k-NN.'
                  : 'Draw a few examples for each group to train your mini-brain—then draw something new and see if it guesses right!'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleLoadDemoExamples}>
                <Wand2 size={15} />
                <span>Load Demo Examples</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setExamplesA([])
                  setExamplesB([])
                  setDrawGrid(createBlankGrid(8))
                  setManualResult(null)
                }}
              >
                <RefreshCw size={15} />
                <span>Reset Brain</span>
              </button>
            </div>
          </div>

          <div className="vision-trainer-grid">
            {/* Left: Interactive 8x8 Drawing Pad */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>Drawing Pad (8×8)</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setDrawGrid(createBlankGrid(8))
                    setManualResult(null)
                  }}
                >
                  <Eraser size={14} />
                  <span>Clear Pad</span>
                </button>
              </div>

              <div className="vision-pixel-grid-wrap">
                <div className="vision-pixel-grid" role="grid" aria-label="Mini-brain drawing pad">
                  {drawGrid.map((rowArr, r) =>
                    rowArr.map((val, c) => (
                      <button
                        key={`t-${r}-${c}`}
                        type="button"
                        aria-label={`Draw cell row ${r + 1} col ${c + 1}`}
                        className={`vision-pixel-cell ${val > 0 ? 'is-on' : ''}`}
                        onPointerDown={() => handleTrainerPointerDown(r, c)}
                        onPointerEnter={() => handleTrainerPointerEnter(r, c)}
                      />
                    )),
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!hasDrawnPixels}
                  onClick={() => handleAddExample('A')}
                >
                  <Plus size={15} />
                  <span>Add to {classAName}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!hasDrawnPixels}
                  onClick={() => handleAddExample('B')}
                >
                  <Plus size={15} />
                  <span>Add to {classBName}</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={liveClassify}
                    onChange={(e) => setLiveClassify(e.target.checked)}
                  />
                  <span>Live-classify as I draw</span>
                </label>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!hasDrawnPixels || examplesA.length === 0 || examplesB.length === 0}
                  onClick={handleManualTest}
                >
                  <Sparkles size={15} />
                  <span>Test My Drawing</span>
                </button>
              </div>
            </div>

            {/* Right: 2 Classes + Live Prediction Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Prediction Readout */}
              <div className="vision-prediction-box" aria-live="polite">
                {examplesA.length === 0 || examplesB.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                    Add at least 1 drawing to both classes (or click <strong>Load Demo Examples</strong>) to wake up your Mini-Brain!
                  </p>
                ) : !livePrediction ? (
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                    Draw something on the pad and click <strong>Test My Drawing</strong> to see what your Mini-Brain predicts!
                  </p>
                ) : (
                  <>
                    <div className="vision-prediction-headline">
                      Mini-Brain guesses: {livePrediction.winner === 'A' ? classAName : classBName}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 4 }}>
                          <span>{classAName}</span>
                          <span className="font-mono">{Math.round(livePrediction.probA * 100)}%</span>
                        </div>
                        <div className="vision-conf-track" style={{ background: '#1e293b' }}>
                          <div
                            className="vision-conf-fill"
                            style={{ width: `${Math.round(livePrediction.probA * 100)}%`, background: '#10b981' }}
                          />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 4 }}>
                          <span>{classBName}</span>
                          <span className="font-mono">{Math.round(livePrediction.probB * 100)}%</span>
                        </div>
                        <div className="vision-conf-track" style={{ background: '#1e293b' }}>
                          <div
                            className="vision-conf-fill"
                            style={{ width: `${Math.round(livePrediction.probB * 100)}%`, background: '#38bdf8' }}
                          />
                        </div>
                      </div>
                    </div>

                    {isDeepDive && (
                      <div className="font-mono" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        cos(A)={livePrediction.cosA.toFixed(2)} · cos(B)={livePrediction.cosB.toFixed(2)} · nearest L2={livePrediction.nearestDist.toFixed(2)}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Class A Card */}
              <div className={`vision-class-card ${livePrediction?.winner === 'A' ? 'is-winner' : ''}`}>
                <div className="vision-class-header">
                  <input
                    type="text"
                    className="vision-class-name-input"
                    value={classAName}
                    onChange={(e) => setClassAName(e.target.value)}
                    aria-label="Class A name"
                  />
                  <span className="badge badge-subtle">{examplesA.length} examples</span>
                </div>
                <div className="vision-thumbs">
                  {examplesA.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No examples yet.</span>
                  ) : (
                    examplesA.map((ex, idx) => (
                      <div key={`a-${idx}`} className="vision-thumb-item">
                        {ex.flat().map((px, pIdx) => (
                          <span key={pIdx} className={`vision-thumb-px ${px ? 'is-on' : ''}`} />
                        ))}
                        <button
                          type="button"
                          className="vision-thumb-remove"
                          aria-label={`Remove ${classAName} example ${idx + 1}`}
                          onClick={() => setExamplesA((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Class B Card */}
              <div className={`vision-class-card ${livePrediction?.winner === 'B' ? 'is-winner' : ''}`}>
                <div className="vision-class-header">
                  <input
                    type="text"
                    className="vision-class-name-input"
                    value={classBName}
                    onChange={(e) => setClassBName(e.target.value)}
                    aria-label="Class B name"
                  />
                  <span className="badge badge-subtle">{examplesB.length} examples</span>
                </div>
                <div className="vision-thumbs">
                  {examplesB.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No examples yet.</span>
                  ) : (
                    examplesB.map((ex, idx) => (
                      <div key={`b-${idx}`} className="vision-thumb-item">
                        {ex.flat().map((px, pIdx) => (
                          <span key={pIdx} className={`vision-thumb-px ${px ? 'is-on' : ''}`} />
                        ))}
                        <button
                          type="button"
                          className="vision-thumb-remove"
                          aria-label={`Remove ${classBName} example ${idx + 1}`}
                          onClick={() => setExamplesB((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Educational Data Diversity Callout */}
              <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
                <strong>{isDeepDive ? 'Why Data Diversity Matters: ' : 'Pro Tip for Better Accuracy: '}</strong>
                {isDeepDive
                  ? 'Adding varied examples (shifted, scaled, or slightly altered) broadens each class cluster in feature space, reducing overfitting and improving generalization on unseen test inputs.'
                  : 'Try adding 3–5 slightly different drawings for each class (big, small, shifted left or right). Just like real AI, your Mini-Brain gets way smarter when it sees lots of different examples!'}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stage Footer Navigation */}
      <nav className="lab-footer-nav" aria-label="Stage navigation">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(prevStage ? prevStage.route : '/')}
        >
          <ArrowLeft size={16} />
          <span>{prevStage ? `Stage ${prevStage.id}: ${prevStage.title}` : 'Back to Pathway'}</span>
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
            onClick={handleMarkComplete}
          >
            <CheckCircle2 size={16} />
            <span>{isDone ? 'Stage 4 Completed' : 'Mark Stage 4 Complete'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(nextStage ? nextStage.route : '/stage/5')}
          >
            <span>Next: Stage 5 →</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>
    </div>
  )
}
