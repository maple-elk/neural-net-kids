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
import TermTip from '../components/TermTip.jsx'
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
   Live CNN X-Ray & Bounding Box Rendering Helpers (Tab 3: Live Camera AI)
   ========================================================================== */

function drawBoundingBoxes(
  ctx,
  detections,
  canvasW,
  canvasH,
  sourceW,
  sourceH,
  selectedIdx = null,
) {
  const scaleX = sourceW > 0 ? canvasW / sourceW : 1
  const scaleY = sourceH > 0 ? canvasH / sourceH : 1
  const palette = ['#10b981', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6']

  detections.forEach((det, idx) => {
    const [bx, by, bw, bh] = det.bbox
    const x = bx * scaleX
    const y = by * scaleY
    const w = bw * scaleX
    const h = bh * scaleY
    const isSelected = selectedIdx === idx
    const color = isSelected ? '#f59e0b' : palette[idx % palette.length]
    const pct = Math.round(det.score * 100)
    const label = `${det.class} ${pct}%`

    if (isSelected) {
      ctx.save()
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)'
      ctx.lineWidth = 8
      ctx.strokeRect(x, y, w, h)
      ctx.restore()
    }

    ctx.strokeStyle = color
    ctx.lineWidth = isSelected ? 4 : 3
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

function computeSobelEdges(srcData, w, h, edgeMode = 'all') {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    gray[i] = 0.299 * srcData[p] + 0.587 * srcData[p + 1] + 0.114 * srcData[p + 2]
  }
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y - 1) * w + (x - 1)]
      const tc = gray[(y - 1) * w + x]
      const tr = gray[(y - 1) * w + (x + 1)]
      const ml = gray[y * w + (x - 1)]
      const mr = gray[y * w + (x + 1)]
      const bl = gray[(y + 1) * w + (x - 1)]
      const bc = gray[(y + 1) * w + x]
      const br = gray[(y + 1) * w + (x + 1)]

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br

      let mag = 0
      if (edgeMode === 'vertical') mag = Math.abs(gx)
      else if (edgeMode === 'horizontal') mag = Math.abs(gy)
      else mag = Math.hypot(gx, gy)

      const norm = Math.min(1, mag / 240)
      const oIdx = (y * w + x) * 4
      out[oIdx] = Math.round(15 + norm * 32)
      out[oIdx + 1] = Math.round(23 + norm * 222)
      out[oIdx + 2] = Math.round(42 + norm * 145)
      out[oIdx + 3] = 255
    }
  }
  return out
}

function renderCnnXrayView(
  xrayCanvas,
  source,
  sourceW,
  sourceH,
  { layer, edgeMode, rawDetections, filteredDetections, threshold },
) {
  if (!xrayCanvas || !source || sourceW <= 0 || sourceH <= 0) return
  const W = 240
  const H = 180
  if (xrayCanvas.width !== W || xrayCanvas.height !== H) {
    xrayCanvas.width = W
    xrayCanvas.height = H
  }
  const ctx = xrayCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  // Draw source frame downsampled to 240x180
  ctx.drawImage(source, 0, 0, W, H)
  const frameImg = ctx.getImageData(0, 0, W, H)
  const data = frameImg.data

  if (layer === 'rgb') {
    const out = ctx.createImageData(W, H)
    const dst = out.data
    const third = Math.floor(W / 3)
    let rSum = 0
    let gSum = 0
    let bSum = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        rSum += r
        gSum += g
        bSum += b
        if (x < third) {
          dst[i] = r
          dst[i + 1] = Math.round(r * 0.12)
          dst[i + 2] = Math.round(r * 0.12)
        } else if (x < third * 2) {
          dst[i] = Math.round(g * 0.12)
          dst[i + 1] = g
          dst[i + 2] = Math.round(g * 0.18)
        } else {
          dst[i] = Math.round(b * 0.12)
          dst[i + 1] = Math.round(b * 0.28)
          dst[i + 2] = b
        }
        dst[i + 3] = 255
      }
    }
    ctx.putImageData(out, 0, 0)
    const n = W * H
    const labels = [
      { txt: `R ${Math.round(rSum / n)}`, x: third * 0.5, col: '#fca5a5' },
      { txt: `G ${Math.round(gSum / n)}`, x: third * 1.5, col: '#6ee7b7' },
      { txt: `B ${Math.round(bSum / n)}`, x: third * 2.5, col: '#93c5fd' },
    ]
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(third, 0)
    ctx.lineTo(third, H)
    ctx.moveTo(third * 2, 0)
    ctx.lineTo(third * 2, H)
    ctx.stroke()

    ctx.font = 'bold 11px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    labels.forEach((l) => {
      ctx.fillStyle = 'rgba(15,23,42,0.78)'
      ctx.fillRect(l.x - 28, 6, 56, 18)
      ctx.fillStyle = l.col
      ctx.fillText(l.txt, l.x, 19)
    })
    ctx.textAlign = 'start'
    return
  }

  if (layer === 'edges') {
    const edgePixels = computeSobelEdges(data, W, H, edgeMode)
    const edgeImg = new ImageData(edgePixels, W, H)
    ctx.putImageData(edgeImg, 0, 0)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
    ctx.fillRect(6, 6, 118, 20)
    ctx.fillStyle = '#34d399'
    ctx.font = 'bold 10px "JetBrains Mono", monospace'
    const modeLabel =
      edgeMode === 'vertical'
        ? 'SOBEL: VERTICAL'
        : edgeMode === 'horizontal'
          ? 'SOBEL: HORIZ.'
          : 'SOBEL: ALL EDGES'
    ctx.fillText(modeLabel, 12, 19)
    return
  }

  if (layer === 'grid') {
    // Dim source image underneath 8x6 SSD anchor grid
    ctx.fillStyle = 'rgba(15, 23, 42, 0.52)'
    ctx.fillRect(0, 0, W, H)

    const cols = 8
    const rows = 6
    const cellW = W / cols
    const cellH = H / rows
    const scaleX = W / sourceW
    const scaleY = H / sourceH

    // Compute simple local contrast energy per cell
    const edgePixels = computeSobelEdges(data, W, H, 'all')

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * cellW
        const cy = r * cellH
        let energy = 0
        let count = 0
        for (let py = Math.floor(cy); py < Math.floor(cy + cellH); py += 2) {
          for (let px = Math.floor(cx); px < Math.floor(cx + cellW); px += 2) {
            energy += edgePixels[(py * W + px) * 4 + 1]
            count++
          }
        }
        const normE = count > 0 ? Math.min(1, energy / (count * 165)) : 0

        const overlapsDet = filteredDetections.some((d) => {
          const [bx, by, bw, bh] = d.bbox
          const dx1 = bx * scaleX
          const dy1 = by * scaleY
          const dx2 = (bx + bw) * scaleX
          const dy2 = (by + bh) * scaleY
          return dx1 < cx + cellW && dx2 > cx && dy1 < cy + cellH && dy2 > cy
        })

        if (overlapsDet) {
          ctx.fillStyle = `rgba(16, 185, 129, ${(0.22 + normE * 0.38).toFixed(2)})`
          ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2)
          ctx.strokeStyle = '#34d399'
          ctx.lineWidth = 1.5
          ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2)
        } else {
          ctx.fillStyle = `rgba(56, 189, 248, ${(normE * 0.25).toFixed(2)})`
          ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2)
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
          ctx.lineWidth = 0.8
          ctx.strokeRect(cx, cy, cellW, cellH)
        }
      }
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'
    ctx.fillRect(6, 6, 154, 20)
    ctx.fillStyle = '#6ee7b7'
    ctx.font = 'bold 10px "JetBrains Mono", monospace'
    ctx.fillText('8×6 SSD ANCHOR HEATMAP', 12, 19)
    return
  }

  // Layer 4: Object Boxes & NMS (show suppressed/below-threshold dashed vs winners solid)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)'
  ctx.fillRect(0, 0, W, H)
  const scaleX = W / sourceW
  const scaleY = H / sourceH

  rawDetections.forEach((det) => {
    const [bx, by, bw, bh] = det.bbox
    const x = bx * scaleX
    const y = by * scaleY
    const w = bw * scaleX
    const h = bh * scaleY
    const passed = det.score >= threshold

    ctx.save()
    if (passed) {
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2.5
      ctx.strokeRect(x, y, w, h)
      ctx.fillStyle = '#10b981'
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace'
      ctx.fillText(`${det.class} ${Math.round(det.score * 100)}%`, x + 2, Math.max(11, y - 3))
    } else {
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.7)'
      ctx.lineWidth = 1.4
      ctx.strokeRect(x, y, w, h)
    }
    ctx.restore()
  })

  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'
  ctx.fillRect(6, 6, 168, 20)
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 10px "JetBrains Mono", monospace'
  ctx.fillText(`NMS FILTER ≥ ${Math.round(threshold * 100)}%`, 12, 19)
}

function renderObjectCropInspector(rgbCanvas, edgeCanvas, source, sourceW, sourceH, bbox) {
  if (!rgbCanvas || !edgeCanvas || !source || !bbox) return
  const [bx, by, bw, bh] = bbox
  const sx = Math.max(0, Math.floor(bx))
  const sy = Math.max(0, Math.floor(by))
  const sw = Math.max(4, Math.min(sourceW - sx, Math.ceil(bw)))
  const sh = Math.max(4, Math.min(sourceH - sy, Math.ceil(bh)))

  const size = 96
  rgbCanvas.width = size
  rgbCanvas.height = size
  edgeCanvas.width = size
  edgeCanvas.height = size

  const rCtx = rgbCanvas.getContext('2d', { willReadFrequently: true })
  const eCtx = edgeCanvas.getContext('2d', { willReadFrequently: true })
  if (!rCtx || !eCtx) return

  rCtx.fillStyle = '#020617'
  rCtx.fillRect(0, 0, size, size)
  const scale = Math.min(size / sw, size / sh)
  const dw = Math.round(sw * scale)
  const dh = Math.round(sh * scale)
  const dx = Math.floor((size - dw) / 2)
  const dy = Math.floor((size - dh) / 2)
  rCtx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)

  const cropImg = rCtx.getImageData(0, 0, size, size)
  const edgePixels = computeSobelEdges(cropImg.data, size, size, 'all')
  eCtx.putImageData(new ImageData(edgePixels, size, size), 0, 0)
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
     Tab 3 State: Live Camera Vision & CNN X-Ray (Lazy-loaded TFJS + COCO-SSD)
     ------------------------------------------------------------------------ */
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const xrayCanvasRef = useRef(null)
  const cropRgbCanvasRef = useRef(null)
  const cropEdgeCanvasRef = useRef(null)
  const uploadedImgRef = useRef(null)
  const fileInputRef = useRef(null)
  const modelRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectingRef = useRef(false)

  const [visionStatus, setVisionStatus] = useState('idle') // idle | loading-model | live | photo | error
  const [statusMessage, setStatusMessage] = useState(
    'Click "Start Live Camera" or "Upload Photo" to run COCO-SSD and inspect every CNN layer live.',
  )
  const [cameraError, setCameraError] = useState('')
  const [rawDetections, setRawDetections] = useState([])
  const [confThreshold, setConfThreshold] = useState(0.45)
  const [xrayLayer, setXrayLayer] = useState('edges') // 'rgb' | 'edges' | 'grid' | 'boxes'
  const [edgeFilterMode, setEdgeFilterMode] = useState('all') // 'all' | 'vertical' | 'horizontal'
  const [selectedDetIdx, setSelectedDetIdx] = useState(null)

  const confThresholdRef = useRef(confThreshold)
  const xrayLayerRef = useRef(xrayLayer)
  const edgeFilterModeRef = useRef(edgeFilterMode)
  const selectedDetIdxRef = useRef(selectedDetIdx)

  const filteredDetections = useMemo(
    () => rawDetections.filter((d) => d.score >= confThreshold),
    [rawDetections, confThreshold],
  )

  useEffect(() => {
    confThresholdRef.current = confThreshold
    xrayLayerRef.current = xrayLayer
    edgeFilterModeRef.current = edgeFilterMode
    selectedDetIdxRef.current = selectedDetIdx
  }, [confThreshold, xrayLayer, edgeFilterMode, selectedDetIdx])

  // Re-render photo overlays, X-Ray view, and selected object crop whenever controls change
  useEffect(() => {
    if (visionStatus !== 'photo' || !uploadedImgRef.current) return
    const img = uploadedImgRef.current
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        drawBoundingBoxes(
          ctx,
          filteredDetections,
          canvas.width,
          canvas.height,
          img.width,
          img.height,
          selectedDetIdx,
        )
      }
    }
    renderCnnXrayView(xrayCanvasRef.current, img, img.width, img.height, {
      layer: xrayLayer,
      edgeMode: edgeFilterMode,
      rawDetections,
      filteredDetections,
      threshold: confThreshold,
    })
    const activeDet =
      selectedDetIdx !== null ? filteredDetections[selectedDetIdx] || null : null
    if (activeDet) {
      renderObjectCropInspector(
        cropRgbCanvasRef.current,
        cropEdgeCanvasRef.current,
        img,
        img.width,
        img.height,
        activeDet.bbox,
      )
    }
  }, [visionStatus, rawDetections, filteredDetections, confThreshold, xrayLayer, edgeFilterMode, selectedDetIdx])

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
          const preds = await modelRef.current.detect(video, 20, 0.1)
          const threshold = confThresholdRef.current
          const filtered = preds.filter((p) => p.score >= threshold)
          const activeSel = selectedDetIdxRef.current

          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            drawBoundingBoxes(ctx, filtered, canvas.width, canvas.height, vw, vh, activeSel)
          }

          renderCnnXrayView(xrayCanvasRef.current, video, vw, vh, {
            layer: xrayLayerRef.current,
            edgeMode: edgeFilterModeRef.current,
            rawDetections: preds,
            filteredDetections: filtered,
            threshold,
          })

          if (activeSel !== null && filtered[activeSel]) {
            renderObjectCropInspector(
              cropRgbCanvasRef.current,
              cropEdgeCanvasRef.current,
              video,
              vw,
              vh,
              filtered[activeSel].bbox,
            )
          }
          setRawDetections(preds)
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
    setSelectedDetIdx(null)
    uploadedImgRef.current = null
    stopCamera()

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('No webcam detected in this browser — upload any photo to explore the live CNN X-Ray!')
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
          ? 'Camera permission was denied — upload any photo to explore the live CNN X-Ray!'
          : 'Camera unavailable on this device — upload any photo to explore the live CNN X-Ray!'
      setCameraError(msg)
      setVisionStatus('idle')
    }
  }

  const handleUploadPhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    stopCamera()
    setCameraError('')
    setSelectedDetIdx(null)

    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = async () => {
        uploadedImgRef.current = img
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
          const preds = await model.detect(img, 20, 0.1)
          setRawDetections(preds)
          setVisionStatus('photo')
          const passed = preds.filter((p) => p.score >= confThresholdRef.current).length
          setStatusMessage(
            preds.length > 0
              ? `COCO-SSD proposed ${preds.length} candidate box(es) (${passed} above ${Math.round(confThresholdRef.current * 100)}%).`
              : 'COCO-SSD ran on your photo but found no candidate objects — try a photo of everyday items!',
          )
        } catch {
          setRawDetections([])
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
      id: 'rgb',
      num: 'LAYER 1',
      title: 'Raw RGB Pixels',
      kid: 'Splits your camera frame into Red, Green, and Blue intensity grids.',
      deep: 'Input frame resized into a 3-channel H×W×3 RGB tensor normalized to [0, 1].',
    },
    {
      id: 'edges',
      num: 'LAYER 2',
      title: 'Edge Filters (Conv1)',
      kid: 'Slides 3×3 Sobel filters over every pixel to trace bright outlines live!',
      deep: 'Early Conv2D layers extract directional spatial gradients (Gx, Gy, magnitude).',
    },
    {
      id: 'grid',
      num: 'LAYER 3',
      title: 'Anchor Grid (SSD)',
      kid: 'Divides the scene into an 8×6 grid and lights up zones packed with object clues.',
      deep: 'Single Shot Detector evaluates spatial anchor boxes & local feature energy per cell.',
    },
    {
      id: 'boxes',
      num: 'LAYER 4',
      title: 'Object Boxes & NMS',
      kid:
        filteredDetections.length > 0
          ? `Kept ${filteredDetections.length} box(es) above ${Math.round(confThreshold * 100)}% (top: ${filteredDetections[0].class}).`
          : 'Filters candidate boxes by confidence threshold & merges overlaps (NMS).',
      deep:
        filteredDetections.length > 0
          ? `Threshold ≥ ${Math.round(confThreshold * 100)}% + NMS kept ${filteredDetections.length}/${rawDetections.length} candidates.`
          : 'Applies confidence thresholding + Non-Maximum Suppression across 80 COCO classes.',
    },
  ]

  const selectedDetection =
    selectedDetIdx !== null ? filteredDetections[selectedDetIdx] || null : null
  const activeXrayStep = pipelineSteps.find((s) => s.id === xrayLayer) || pipelineSteps[1]

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
        {isDeepDive ? (
          <>
            Convolutional Neural Networks (CNNs) use 2D{' '}
            <TermTip id="convolution">convolution</TermTip> with learned{' '}
            <TermTip id="kernel">kernels</TermTip>, spatial{' '}
            <TermTip id="pooling">pooling</TermTip>, and{' '}
            <TermTip id="softmax">softmax</TermTip> heads to turn raw pixel grids into object
            predictions.
          </>
        ) : (
          <>
            Computers don’t have eyes—they only see grids of numbers! Slide a 3×3{' '}
            <TermTip id="convolution">convolution</TermTip> magnifying glass over pixel art, watch{' '}
            <TermTip id="pooling">pooling</TermTip> &amp;{' '}
            <TermTip id="softmax">softmax</TermTip> read your handwriting, test a real camera AI,
            and teach your own mini-brain!
          </>
        )}
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
              Choose a 3×3 <TermTip id="kernel">filter kernel</TermTip>:{' '}
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
                {isDeepDive ? (
                  <>
                    16×16 normalized ink → 4×4 average <TermTip id="pooling">pooling</TermTip> → 16
                    input neurons below. Hover any zone to trace its exact block &amp; synapses!
                  </>
                ) : (
                  <>
                    <TermTip id="pooling">Pooling</TermTip> averages each dashed 4×4 square into 1
                    brightness number. Hover any square to highlight its matching neuron below!
                  </>
                )}
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
            {isDeepDive ? (
              <>
                Raw canvas strokes are cropped, centered onto a 16×16 grid (256 pixels), summarized
                via 4×4 <TermTip id="pooling">pooling</TermTip> &amp; gradient features, and turned
                into class probabilities with <TermTip id="softmax">softmax</TermTip>.
              </>
            ) : (
              <>
                First the AI trims empty space and centers your stroke inside a 16×16 grid, shrinks
                it with <TermTip id="pooling">pooling</TermTip>, scores every character, and uses{' '}
                <TermTip id="softmax">softmax</TermTip> to turn those scores into percentages!
              </>
            )}
          </div>
        </section>
      )}

      {/* ====================================================================
          TAB 3: LIVE CAMERA VISION & CNN X-RAY (REAL BROWSER NEURAL NET)
          ==================================================================== */}
      {activeTab === 'camera' && (
        <section className="lab-card" aria-label="Live Camera AI Object Detector">
          <div className="vision-section-header">
            <div>
              <h2>Live Camera AI &amp; CNN X-Ray</h2>
              <p>
                {isDeepDive
                  ? 'Run MobileNetV2-SSD locally via TensorFlow.js and inspect live RGB channels, Sobel Conv1 edge maps, 8×6 SSD anchor energy, and confidence thresholding in real time.'
                  : 'Start your camera or upload any photo, then click the 4 CNN X-Ray layers below to watch how a real neural network sees pixels, edges, grids, and objects!'}
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
                      ? 'Photo Analyzed'
                      : 'Ready (Model Lazy-Loaded)'}
              </span>
            </span>
          </div>

          {/* Action Toolbar: Live Camera + Upload Photo only */}
          <div className="vision-camera-toolbar">
            {visionStatus === 'live' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  playClick()
                  stopCamera()
                  setVisionStatus('idle')
                }}
              >
                <CameraOff size={16} />
                <span>Stop Camera</span>
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleStartCamera}>
                <Camera size={16} />
                <span>Start Live Camera</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                playClick()
                fileInputRef.current?.click()
              }}
            >
              <Upload size={16} />
              <span>Upload Photo</span>
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

          {/* Clickable 4-Stage Interactive CNN X-Ray Pipeline Strip */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <h3 style={{ fontSize: '1.02rem' }}>Click a Neural Network Layer to X-Ray:</h3>
              <span className="badge badge-subtle">
                {mode === 'deep-dive' ? 'Interactive CNN Feature Inspector' : 'Click any layer!'}
              </span>
            </div>
            <div className="vision-pipeline-strip" role="group" aria-label="CNN X-Ray layer selector">
              {pipelineSteps.map((step) => {
                const isSelected = xrayLayer === step.id
                return (
                  <button
                    key={step.id}
                    type="button"
                    aria-pressed={isSelected}
                    className={`vision-pipeline-step vision-pipeline-step-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      playClick()
                      setXrayLayer(step.id)
                    }}
                  >
                    <span className="vision-pipeline-num">{step.num}</span>
                    <span className="vision-pipeline-title">{step.title}</span>
                    <span className="vision-pipeline-desc">{isDeepDive ? step.deep : step.kid}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Side-by-Side Feed + Neural Net X-Ray View + Controls Sidebar */}
          <div className="vision-stage-grid">
            <div className="vision-xray-pair">
              {/* Left Canvas: Main Camera / Photo Feed with Bounding Boxes */}
              <div className="vision-viewport-card">
                <div className="vision-viewport-label">
                  <span>Camera / Photo Feed</span>
                  <span className="badge badge-subtle">
                    {filteredDetections.length} box{filteredDetections.length === 1 ? '' : 'es'}
                  </span>
                </div>
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
                      <Camera size={36} color="#34d399" />
                      <p style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
                        {visionStatus === 'loading-model'
                          ? 'Downloading COCO-SSD weights...'
                          : 'Start Live Camera or Upload a Photo'}
                      </p>
                      <p style={{ fontSize: '0.8rem' }}>
                        Runs 100% locally in your browser — nothing is uploaded to any server.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Canvas: Live Neural Net X-Ray View */}
              <div className="vision-viewport-card">
                <div className="vision-viewport-label">
                  <span>Neural Net X-Ray: {activeXrayStep.title}</span>
                  {xrayLayer === 'edges' && (
                    <div className="vision-xray-subtabs" role="group" aria-label="Edge filter direction">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'vertical', label: 'Vert' },
                        { id: 'horizontal', label: 'Horiz' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`vision-xray-subbtn ${edgeFilterMode === opt.id ? 'is-active' : ''}`}
                          onClick={() => {
                            playClick()
                            setEdgeFilterMode(opt.id)
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="vision-viewport">
                  <canvas
                    ref={xrayCanvasRef}
                    style={{
                      display: visionStatus === 'live' || visionStatus === 'photo' ? 'block' : 'none',
                    }}
                  />
                  {visionStatus !== 'live' && visionStatus !== 'photo' && (
                    <div className="vision-viewport-placeholder">
                      <Sparkles size={34} color="#38bdf8" />
                      <p style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                        {activeXrayStep.num}: {activeXrayStep.title}
                      </p>
                      <p style={{ fontSize: '0.8rem' }}>
                        {isDeepDive ? activeXrayStep.deep : activeXrayStep.kid}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel: Confidence Threshold Slider + Clickable Detections + Object Inspector */}
            <div className="vision-panel">
              <div className="vision-panel-title">
                <span>Neural Net Controls</span>
                <span className="badge badge-subtle">{Math.round(confThreshold * 100)}% min</span>
              </div>

              {/* Live Confidence Threshold Slider */}
              <div className="vision-threshold-box">
                <div className="vision-threshold-head">
                  <label htmlFor="vision-conf-threshold">Confidence Threshold</label>
                  <span className="font-mono" style={{ color: '#059669' }}>
                    {Math.round(confThreshold * 100)}%
                  </span>
                </div>
                <input
                  id="vision-conf-threshold"
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={Math.round(confThreshold * 100)}
                  className="vision-threshold-slider"
                  onChange={(e) => {
                    setConfThreshold(Number(e.target.value) / 100)
                    setSelectedDetIdx(null)
                  }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Showing <strong>{filteredDetections.length}</strong> of{' '}
                  <strong>{rawDetections.length}</strong> candidate detections above{' '}
                  {Math.round(confThreshold * 100)}% threshold
                </span>
              </div>

              {/* Clickable Detections List */}
              {filteredDetections.length === 0 ? (
                <div
                  style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontSize: '0.84rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-strong)',
                  }}
                >
                  {rawDetections.length > 0
                    ? `All ${rawDetections.length} candidate(s) are below ${Math.round(confThreshold * 100)}% — try lowering the threshold slider!`
                    : statusMessage}
                </div>
              ) : (
                <div className="vision-detection-list" role="list" aria-label="Detected objects">
                  {filteredDetections.map((det, idx) => {
                    const pct = Math.round(det.score * 100)
                    const isSelected = selectedDetIdx === idx
                    return (
                      <button
                        key={`${det.class}-${idx}`}
                        type="button"
                        aria-pressed={isSelected}
                        className={`vision-detection-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          playClick()
                          setSelectedDetIdx((prev) => (prev === idx ? null : idx))
                        }}
                      >
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
                              background: isSelected ? '#f59e0b' : pct >= 75 ? '#10b981' : '#0ea5e9',
                            }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Clickable Detection Object Inspector */}
              {selectedDetection && (
                <div className="vision-object-inspector" aria-live="polite">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ textTransform: 'capitalize', color: '#fbbf24' }}>
                      Inspecting: {selectedDetection.class}
                    </strong>
                    <span className="font-mono" style={{ fontSize: '0.76rem', color: '#6ee7b7' }}>
                      {Math.round(selectedDetection.score * 100)}% vs {Math.round(confThreshold * 100)}% min
                    </span>
                  </div>

                  <div className="vision-inspector-crops">
                    <div className="vision-inspector-crop-box">
                      <canvas ref={cropRgbCanvasRef} aria-label="Cropped RGB object patch" />
                      <span>Cropped RGB Patch</span>
                    </div>
                    <div className="vision-inspector-crop-box">
                      <canvas ref={cropEdgeCanvasRef} aria-label="Extracted object edge mini-map" />
                      <span>Extracted Edges</span>
                    </div>
                  </div>

                  <div className="font-mono" style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    bbox: (x={Math.round(selectedDetection.bbox[0])}, y={Math.round(selectedDetection.bbox[1])}, w={Math.round(selectedDetection.bbox[2])}, h={Math.round(selectedDetection.bbox[3])})
                  </div>
                </div>
              )}
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
