import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Eye,
  Scissors,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById } from '../utils/pathwayLoader.js'
import {
  ATTENTION_EXAMPLES,
  EMBEDDING_WORDS,
  WORD_MATH_PRESETS,
  findNearestWords,
  tokenize,
  wordMath,
} from '../engine/miniLlm.js'
import { playClick, playSuccess } from '../utils/sound.js'
import TermTip from '../components/TermTip.jsx'
import './LanguageLab.css'

const TOKEN_PRESETS = [
  'Unbelievable robots are learning!',
  'Supercalifragilistic!',
  'Rebuilding 42 wonderful spaceships.',
  'Misunderstanding disconnected computers',
]

const TOKEN_PALETTE = [
  { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6' },
  { bg: '#e0f2fe', border: '#7dd3fc', text: '#0369a1' },
  { bg: '#d1fae5', border: '#6ee7b7', text: '#047857' },
  { bg: '#fef3c7', border: '#fcd34d', text: '#b45309' },
  { bg: '#ffe4e6', border: '#fda4af', text: '#be123c' },
  { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3' },
  { bg: '#ffedd5', border: '#fdba74', text: '#c2410c' },
  { bg: '#ccfbf1', border: '#5eead4', text: '#0f766e' },
]

const CATEGORY_META = {
  royalty: { label: 'Royalty', color: '#8b5cf6' },
  animals: { label: 'Animals', color: '#f59e0b' },
  places: { label: 'Places', color: '#10b981' },
  food: { label: 'Food', color: '#f43f5e' },
  space: { label: 'Space', color: '#0ea5e9' },
  tech: { label: 'Tech', color: '#4f46e5' },
}

// ---------- Self-Attention data (Winograd pairs + chameleon "bank" pair) ----------

function buildWeights(tokens, links) {
  const n = tokens.length
  return tokens.map((_, q) => {
    const row = new Array(n).fill(0.03)
    row[q] = 0.2
    if (q > 0) row[q - 1] += 0.06
    if (q < n - 1) row[q + 1] += 0.06
    for (const [k, w] of Object.entries(links[q] || {})) row[Number(k)] = w
    const sum = row.reduce((a, v) => a + v, 0)
    return row.map((v) => Number((v / sum).toFixed(4)))
  })
}

const BANK_RIVER_TOKENS = ['I', 'sat', 'by', 'the', 'river', 'bank', 'to', 'watch', 'the', 'boats']
const BANK_MONEY_TOKENS = ['I', 'went', 'to', 'the', 'city', 'bank', 'to', 'deposit', 'money']

const BANK_EXAMPLES = [
  {
    id: 'bank-river',
    pairId: 'bank',
    title: 'River Bank',
    sentence: BANK_RIVER_TOKENS.join(' '),
    tokens: BANK_RIVER_TOKENS,
    focusIndex: 5,
    referentIndex: 4,
    explanation:
      'Neighbors like "river" and "boats" shout WATER! Attention makes "bank" borrow their meaning, so it becomes a muddy riverside.',
    weights: buildWeights(BANK_RIVER_TOKENS, {
      5: { 4: 0.55, 9: 0.26, 1: 0.12, 5: 0.14 },
      4: { 5: 0.4, 3: 0.2, 4: 0.2 },
      9: { 5: 0.3, 4: 0.3, 9: 0.2 },
    }),
  },
  {
    id: 'bank-money',
    pairId: 'bank',
    title: 'Money Bank',
    sentence: BANK_MONEY_TOKENS.join(' '),
    tokens: BANK_MONEY_TOKENS,
    focusIndex: 5,
    referentIndex: 8,
    explanation:
      'Now the neighbors are "deposit", "money" and "city". Same word "bank", totally different meaning — attention swaps the clues!',
    weights: buildWeights(BANK_MONEY_TOKENS, {
      5: { 8: 0.5, 7: 0.32, 4: 0.22, 5: 0.14 },
      7: { 8: 0.4, 5: 0.34, 7: 0.2 },
      8: { 7: 0.4, 5: 0.3, 8: 0.2 },
    }),
  },
]

const EXAMPLE_MEANINGS = {
  'trophy-big': {
    question: 'Who am I referring to, and what clue describes me?',
    before: 'Blurry generic pronoun (could mean anything)',
    after: "An oversized trophy that couldn't fit!",
  },
  'trophy-small': {
    question: 'Who am I referring to, and what clue describes me?',
    before: 'Blurry generic pronoun (could mean anything)',
    after: 'A suitcase that is too small!',
  },
  'animal-tired': {
    question: 'Who am I referring to, and what clue describes me?',
    before: 'Blurry generic pronoun (could mean anything)',
    after: 'A tired animal that needs a rest!',
  },
  'animal-wide': {
    question: 'Who am I referring to, and what clue describes me?',
    before: 'Blurry generic pronoun (could mean anything)',
    after: 'A street that is too wide to cross!',
  },
  'bank-river': {
    question: 'Am I a muddy riverbank or a money building?',
    before: 'Ambiguous word — water or money?',
    after: 'A grassy riverside where boats float!',
  },
  'bank-money': {
    question: 'Am I a muddy riverbank or a money building?',
    before: 'Ambiguous word — water or money?',
    after: 'A building where people keep their money!',
  },
}

const ALL_ATTENTION_EXAMPLES = [...ATTENTION_EXAMPLES, ...BANK_EXAMPLES].map((ex) => ({
  ...ex,
  ...EXAMPLE_MEANINGS[ex.id],
}))

const ATTENTION_PAIRS = [
  {
    id: 'trophy',
    emoji: '🏆',
    title: 'Trophy vs. Suitcase',
    prefix: "The trophy didn't fit in the suitcase because it was too",
    suffix: '',
    options: [
      { word: 'big', exampleId: 'trophy-big' },
      { word: 'small', exampleId: 'trophy-small' },
    ],
  },
  {
    id: 'animal',
    emoji: '🐾',
    title: 'Animal vs. Street',
    prefix: "The animal didn't cross the street because it was too",
    suffix: '',
    options: [
      { word: 'tired', exampleId: 'animal-tired' },
      { word: 'wide', exampleId: 'animal-wide' },
    ],
  },
  {
    id: 'bank',
    emoji: '🏦',
    title: 'Chameleon Word: "bank"',
    prefix: 'I sat down by the',
    suffix: 'bank',
    options: [
      { word: 'river', exampleId: 'bank-river' },
      { word: 'money', exampleId: 'bank-money' },
    ],
  },
]

const ATTENTION_HEADS = [
  { emoji: '🧑', name: 'Head 1: Who?', desc: 'tracks pronouns like "it" → "trophy"' },
  { emoji: '📏', name: 'Head 2: Size & Adjectives', desc: 'links "big" / "small" to what they describe' },
  { emoji: '🏃', name: 'Head 3: Actions', desc: 'connects verbs like "fit" or "cross" to their subjects' },
]

const RECIPE_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b']

const SVG_W = 560
const SVG_H = 420
const SVG_PAD = 42

function toSvgX(x) {
  return SVG_PAD + ((x + 1) / 2) * (SVG_W - SVG_PAD * 2)
}

function toSvgY(y) {
  return SVG_H - SVG_PAD - ((y + 1) / 2) * (SVG_H - SVG_PAD * 2)
}

const VIEW_DEFAULT = { yaw: -0.6, pitch: 0.35 }

const CUBE_CORNERS = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
]
const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
]

function project2D(v) {
  return { sx: toSvgX(v.x), sy: toSvgY(v.y), depth: 0, persp: 1 }
}

function project3D(v, yaw, pitch, zoom) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const x1 = v.x * cy + v.z * sy
  const z1 = -v.x * sy + v.z * cy
  const y2 = v.y * cp - z1 * sp
  const z2 = v.y * sp + z1 * cp
  const camera = 3.6
  const persp = camera / (camera - z2)
  const scale = 150 * zoom
  return {
    sx: SVG_W / 2 + x1 * persp * scale,
    sy: SVG_H / 2 - y2 * persp * scale,
    depth: z2,
    persp,
  }
}

export default function LanguageLab() {
  const { isDeepDive, completedStages, markStageComplete, navigate } = useLearning()
  const stage = getStageById(5)
  const isDone = completedStages.has(5)

  // Section 1: Token Chunker
  const [inputText, setInputText] = useState(TOKEN_PRESETS[0])
  const tokens = useMemo(() => tokenize(inputText), [inputText])
  const wordCount = useMemo(() => {
    const trimmed = inputText.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [inputText])
  const nonSpaceTokenCount = useMemo(
    () => tokens.filter((t) => t.type !== 'space').length,
    [tokens],
  )
  const subwordPiecesCount = useMemo(
    () => tokens.filter((t) => t.type === 'prefix' || t.type === 'suffix').length,
    [tokens],
  )

  // Section 2: Meaning Map (2D / 3D) & Word Math
  const [activeCategory, setActiveCategory] = useState('all')
  const [hoveredWord, setHoveredWord] = useState(null)
  const [selectedWord, setSelectedWord] = useState(null)
  const [wordA, setWordA] = useState('king')
  const [wordB, setWordB] = useState('man')
  const [wordC, setWordC] = useState('woman')
  const [viewMode, setViewMode] = useState('2d')
  const [yaw, setYaw] = useState(VIEW_DEFAULT.yaw)
  const [pitch, setPitch] = useState(VIEW_DEFAULT.pitch)
  const [zoom, setZoom] = useState(1)
  const [autoSpin, setAutoSpin] = useState(false)
  const [mathStep, setMathStep] = useState(4)
  const dragRef = useRef(null)
  const replayTimersRef = useRef([])
  const is3D = viewMode === '3d'

  const mathResult = useMemo(() => {
    try {
      return wordMath(wordA, wordB, wordC, { topN: 3, use3D: is3D })
    } catch {
      return null
    }
  }, [wordA, wordB, wordC, is3D])

  const offsetLabel = useMemo(
    () => WORD_MATH_PRESETS.find((p) => p.a === wordA && p.b === wordB)?.offsetLabel || 'Meaning shift',
    [wordA, wordB],
  )

  const neighbors = useMemo(
    () => (selectedWord ? findNearestWords(selectedWord, 3, is3D) : []),
    [selectedWord, is3D],
  )

  useEffect(() => {
    if (!(is3D && autoSpin)) return undefined
    const id = window.setInterval(() => setYaw((y) => y + 0.012), 40)
    return () => window.clearInterval(id)
  }, [is3D, autoSpin])

  useEffect(() => {
    const timers = replayTimersRef.current
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  const clearReplay = () => {
    replayTimersRef.current.forEach((t) => window.clearTimeout(t))
    replayTimersRef.current = []
  }

  const handleStep = (step) => {
    clearReplay()
    playClick()
    setMathStep(step)
  }

  const handleReplay = () => {
    clearReplay()
    playClick()
    setMathStep(1)
    replayTimersRef.current = [2, 3, 4].map((s, i) =>
      window.setTimeout(() => setMathStep(s), (i + 1) * 1000),
    )
  }

  const handleViewMode = (mode) => {
    playClick()
    setViewMode(mode)
  }

  const resetView = () => {
    playClick()
    setYaw(VIEW_DEFAULT.yaw)
    setPitch(VIEW_DEFAULT.pitch)
    setZoom(1)
  }

  const setCamera = (nextYaw, nextPitch) => {
    playClick()
    setYaw(nextYaw)
    setPitch(nextPitch)
  }

  const handleMapPointerDown = (e) => {
    if (!is3D) return
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false }
  }

  const handleMapPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return
      d.moved = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Pointer capture is optional
      }
    }
    setYaw((y) => y + dx * 0.01)
    setPitch((p) => Math.max(-1.45, Math.min(1.45, p + dy * 0.01)))
    d.x = e.clientX
    d.y = e.clientY
  }

  const handleMapPointerEnd = () => {
    dragRef.current = null
  }

  const projectPoint = (v) => (is3D ? project3D(v, yaw, pitch, zoom) : project2D(v))
  const fmtVec = (v) =>
    is3D
      ? `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`
      : `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}]`

  const mapNodes = EMBEDDING_WORDS.map((item) => ({ item, ...projectPoint(item) })).sort(
    (a, b) => a.depth - b.depth,
  )
  const selectedObj = selectedWord ? EMBEDDING_WORDS.find((w) => w.word === selectedWord) : null
  const infoWord = hoveredWord || selectedObj

  // Screen-space label collision avoidance for 3D Word Cloud (always show priority words)
  const visible3DLabels = (() => {
    if (!is3D) return null
    const prioritySet = new Set()
    if (mathResult) {
      prioritySet.add(mathResult.inputs.a.word)
      prioritySet.add(mathResult.inputs.b.word)
      prioritySet.add(mathResult.inputs.c.word)
      if (mathStep >= 4 && mathResult.bestMatch) prioritySet.add(mathResult.bestMatch.word)
    }
    if (hoveredWord) prioritySet.add(hoveredWord.word)
    if (selectedWord) prioritySet.add(selectedWord)
    neighbors.forEach((n) => prioritySet.add(n.word))

    const placed = []
    const visible = new Set()
    const overlaps = (box) =>
      placed.some(
        (b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2),
      )
    const makeBox = (node, emphasized) => {
      const r = (emphasized ? 8.5 : 6.5) * node.persp
      const w = (node.item.word.length + 3.2) * 6.3 * Math.max(0.8, node.persp)
      const h = 16 * Math.max(0.8, node.persp)
      return {
        x1: node.sx - w / 2,
        x2: node.sx + w / 2,
        y1: node.sy - r - h - 2,
        y2: node.sy - r + 2,
      }
    }

    // Reserve priority words first (front-to-back)
    const frontToBack = [...mapNodes].reverse()
    for (const node of frontToBack) {
      if (prioritySet.has(node.item.word)) {
        visible.add(node.item.word)
        placed.push(makeBox(node, true))
      }
    }
    // Add background labels only when they don't collide
    for (const node of frontToBack) {
      if (prioritySet.has(node.item.word)) continue
      const box = makeBox(node, false)
      if (!overlaps(box)) {
        visible.add(node.item.word)
        placed.push(box)
      }
    }
    return visible
  })()

  // Section 3: Self-Attention Spotlight
  const [exampleId, setExampleId] = useState(ALL_ATTENTION_EXAMPLES[0].id)
  const [attentionOn, setAttentionOn] = useState(true)
  const activeExample = useMemo(
    () => ALL_ATTENTION_EXAMPLES.find((ex) => ex.id === exampleId) || ALL_ATTENTION_EXAMPLES[0],
    [exampleId],
  )
  const activePair = useMemo(
    () => ATTENTION_PAIRS.find((p) => p.options.some((o) => o.exampleId === exampleId)) || ATTENTION_PAIRS[0],
    [exampleId],
  )
  const activeFlipWord = activePair.options.find((o) => o.exampleId === exampleId)?.word
  const [queryIndex, setQueryIndex] = useState(ALL_ATTENTION_EXAMPLES[0].focusIndex)

  const handleSelectPair = (pair) => {
    playClick()
    const ex = ALL_ATTENTION_EXAMPLES.find((e) => e.id === pair.options[0].exampleId)
    setExampleId(ex.id)
    setQueryIndex(ex.focusIndex)
  }

  const handleFlip = (nextId) => {
    if (nextId === exampleId) return
    playClick()
    const ex = ALL_ATTENTION_EXAMPLES.find((e) => e.id === nextId)
    setExampleId(nextId)
    setQueryIndex((prev) => (prev < ex.tokens.length ? prev : ex.focusIndex))
  }

  const handleFlipToggle = () => {
    const other = activePair.options.find((o) => o.exampleId !== exampleId)
    if (other) handleFlip(other.exampleId)
  }

  const activeWeights = useMemo(() => {
    const safeIdx = Math.min(queryIndex, activeExample.tokens.length - 1)
    return activeExample.weights[safeIdx] || []
  }, [activeExample, queryIndex])

  const rankedLinks = useMemo(() => {
    return activeWeights
      .map((weight, idx) => ({
        idx,
        token: activeExample.tokens[idx],
        weight,
      }))
      .filter((item) => item.idx !== queryIndex)
      .sort((a, b) => b.weight - a.weight)
  }, [activeWeights, activeExample.tokens, queryIndex])

  const topAttentionLinks = useMemo(() => rankedLinks.slice(0, 3), [rankedLinks])
  const top4Links = useMemo(() => rankedLinks.slice(0, 4), [rankedLinks])

  const queryWord = activeExample.tokens[queryIndex]
  const isFocusQuery = queryIndex === activeExample.focusIndex
  const queryQuestion = isFocusQuery
    ? activeExample.question
    : 'Which nearby words give me the most context?'
  const meaning = isFocusQuery
    ? { before: activeExample.before, after: activeExample.after }
    : {
        before: `Just the plain word "${queryWord}" on its own`,
        after: `"${queryWord}" flavored with ${topAttentionLinks
          .slice(0, 2)
          .map((l) => `"${l.token}"`)
          .join(' and ')} from nearby`,
      }

  const handleMarkComplete = () => {
    playSuccess()
    if (!isDone) {
      try {
        confetti({ particleCount: 70, spread: 65, origin: { y: 0.72 } })
      } catch {
        // Ignore confetti errors in non-canvas environments
      }
    }
    markStageComplete(5)
  }

  const sortedWords = useMemo(
    () => [...EMBEDDING_WORDS].sort((a, b) => a.word.localeCompare(b.word)),
    [],
  )

  const arcSvgWidth = 760
  const arcSvgHeight = 148
  const tokenCount = activeExample.tokens.length
  const tokenCenterX = (idx) => ((idx + 0.5) / tokenCount) * arcSvgWidth

  return (
    <div className="lab-page lang-lab">
      {/* Lab Header */}
      <header className="lab-header" style={{ '--stage-accent': stage?.color || '#8b5cf6' }}>
        <div>
          <div className="stage-card-badges">
            <span
              className="badge"
              style={{
                background: '#8b5cf61a',
                color: '#7c3aed',
                border: '1px solid #8b5cf644',
              }}
            >
              Stage 5 · {stage?.level || 'Builder'}
            </span>
            <span className="badge badge-subtle">{stage?.ageBadge || 'Ages 11+'}</span>
            {isDone && (
              <span className="badge badge-success">
                <CheckCircle2 size={13} />
                Completed
              </span>
            )}
          </div>
          <h1>{stage?.title || 'Words, Vectors & Attention'}</h1>
          <p className="stage-card-subtitle">
            {stage?.subtitle || 'Turn language into coordinates and spotlights'}
          </p>
        </div>

        <button
          type="button"
          className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
          onClick={handleMarkComplete}
        >
          <CheckCircle2 size={16} />
          <span>{isDone ? 'Stage 5 Completed' : 'Mark Stage 5 Complete'}</span>
        </button>
      </header>

      {/* Mode Overview Callout */}
      <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
        <strong>{isDeepDive ? 'Deep-Dive Lens: ' : 'Explorer Mission: '}</strong>
        {isDeepDive
          ? 'Before a Transformer can predict the next word, it converts raw text into integer token IDs (subword BPE), maps each token into a dense embedding vector space where semantic relationships become linear offsets, and applies self-attention to route contextual information between tokens.'
          : 'Computers only understand numbers—not English! In this lab, you will discover the 3 superpowers modern AI uses to read: chopping words into Lego-like tokens, placing them on a 2D Meaning Map, and shining an Attention Spotlight so words like "it" make sense.'}
      </div>

      {/* ================================================================
          SECTION 1: TOKEN CHUNKER
         ================================================================ */}
      <section className="lab-card lang-section" aria-labelledby="section-tokens-title">
        <div className="lang-section-head">
          <div>
            <div className="lang-section-title-row">
              <span className="lang-section-num">1</span>
              <h2 id="section-tokens-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Scissors size={20} color="#7c3aed" />
                Token Chunker
              </h2>
            </div>
            <p className="lang-section-desc">
              Type any sentence below or tap a preset. Watch how AI splits long words into reusable{' '}
              <TermTip id="token">tokens</TermTip> and gives each piece a numeric Token ID.
            </p>
          </div>
        </div>

        <div className="token-presets" role="group" aria-label="Preset sentences">
          <span className="token-preset-label">Try a preset:</span>
          {TOKEN_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`preset-chip ${inputText === preset ? 'is-active' : ''}`}
              onClick={() => setInputText(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="token-input-wrap">
          <label htmlFor="token-chunker-input" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Your Sentence
          </label>
          <input
            id="token-chunker-input"
            type="text"
            className="token-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a word or sentence to tokenize..."
          />
        </div>

        <div className="token-stats-bar">
          <div className="stat-pill">
            <span>Words:</span>
            <strong>{wordCount}</strong>
          </div>
          <div className="stat-pill is-highlight">
            <span>Total Tokens:</span>
            <strong>{tokens.length}</strong>
          </div>
          <div className="stat-pill">
            <span>Non-Space Tokens:</span>
            <strong>{nonSpaceTokenCount}</strong>
          </div>
          <div className="stat-pill">
            <span>Prefix/Suffix Splits:</span>
            <strong>{subwordPiecesCount}</strong>
          </div>
        </div>

        <div className="token-tray" aria-live="polite">
          {tokens.length === 0 ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              Start typing above to see your text turn into colorful token bricks!
            </span>
          ) : (
            tokens.map((tok, idx) => {
              const palette = TOKEN_PALETTE[tok.colorIndex % TOKEN_PALETTE.length]
              const isSpace = tok.type === 'space'
              const displayText = isSpace ? '␣' : tok.text
              return (
                <div key={`${tok.id}-${idx}`} className="token-brick">
                  <span
                    className={`token-pill ${isSpace ? 'is-space' : ''}`}
                    style={{
                      background: isSpace ? '#f1f5f9' : palette.bg,
                      borderColor: isSpace ? '#cbd5e1' : palette.border,
                      color: isSpace ? '#64748b' : palette.text,
                    }}
                    title={`Token "${tok.text}" (${tok.type}) — ID #${tok.id}`}
                  >
                    {displayText}
                  </span>
                  <div className="token-meta">
                    <span className="token-id">#{tok.id}</span>
                    {(tok.type === 'prefix' || tok.type === 'suffix') && (
                      <span className="token-type-tag">{tok.type}</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {isDeepDive ? (
          <div className="callout-deep">
            <strong>Deep-Dive — Subword Tokenization (BPE / WordPiece):</strong> Real LLMs (like GPT-4 or Gemini) learn a vocabulary of ~50,000 to 256,000 subword chunks by repeatedly merging frequent character pairs. Common words stay whole, while rare or compound words like <code>Unbelievable</code> break into known morphemes (<code>Un</code> + <code>believable</code>) so the model never hits an &ldquo;unknown word&rdquo; dead end.
          </div>
        ) : (
          <div className="callout-kid">
            <strong>Why split words into chunks?</strong> Notice how <code>Unbelievable</code> splits into <code>Un</code> + <code>believable</code>, and <code>learning</code> splits into <code>learn</code> + <code>ing</code>! Instead of memorizing every possible word on Earth, AI learns reusable word Lego bricks and assigns each brick its own ID number.
          </div>
        )}
      </section>

      {/* ================================================================
          SECTION 2: MEANING MAP (2D / 3D) & WORD MATH
         ================================================================ */}
      <section className="lab-card lang-section" aria-labelledby="section-embeddings-title">
        <div className="lang-section-head">
          <div>
            <div className="lang-section-title-row">
              <span className="lang-section-num">2</span>
              <h2 id="section-embeddings-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Compass size={20} color="#7c3aed" />
                Meaning Map &amp; Word Math
              </h2>
            </div>
            <p className="lang-section-desc">
              AI turns every word into a coordinate <TermTip id="embedding">embedding</TermTip> on a Meaning Map. Words with similar meanings live in the same neighborhood—so you can literally do math with meanings!
            </p>
          </div>

          <div className="view-toggle" role="tablist" aria-label="Map view">
            <button
              type="button"
              role="tab"
              aria-selected={!is3D}
              className={`view-toggle-btn ${!is3D ? 'is-active' : ''}`}
              onClick={() => handleViewMode('2d')}
            >
              🗺️ 2D Map
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={is3D}
              className={`view-toggle-btn ${is3D ? 'is-active' : ''}`}
              onClick={() => handleViewMode('3d')}
            >
              🧊 3D Word Cloud
            </button>
          </div>
        </div>

        <div className="embedding-layout">
          {/* Left: Interactive 2D / 3D map */}
          <div className="embedding-map-card">
            <div className="category-legend" role="group" aria-label="Filter word categories">
              <button
                type="button"
                className={`legend-chip ${activeCategory === 'all' ? 'is-active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                All Words
              </button>
              {Object.entries(CATEGORY_META).map(([catKey, meta]) => (
                <button
                  key={catKey}
                  type="button"
                  className={`legend-chip ${activeCategory === catKey ? 'is-active' : ''}`}
                  onClick={() => setActiveCategory(activeCategory === catKey ? 'all' : catKey)}
                >
                  <span className="legend-dot" style={{ background: meta.color }} />
                  {meta.label}
                </button>
              ))}
            </div>

            <div
              className={`embedding-svg-wrap ${is3D ? 'is-3d' : ''}`}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={handleMapPointerEnd}
              onPointerCancel={handleMapPointerEnd}
            >
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="embedding-svg"
                role="img"
                aria-label={
                  is3D
                    ? '3D word cloud. Drag to rotate. Shows word math vector arrows.'
                    : '2D word embedding scatter plot with vector analogy arrows'
                }
              >
                <defs>
                  <marker id="arrow-rel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                  <marker id="arrow-target" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
                  </marker>
                </defs>

                {/* Backdrop: 2D grid OR 3D cube + axes */}
                {!is3D &&
                  [-0.5, 0, 0.5].map((v) => (
                    <g key={v}>
                      <line
                        x1={toSvgX(v)}
                        y1={SVG_PAD / 2}
                        x2={toSvgX(v)}
                        y2={SVG_H - SVG_PAD / 2}
                        stroke={v === 0 ? '#cbd5e1' : '#f1f5f9'}
                        strokeWidth={v === 0 ? 1.4 : 1}
                        strokeDasharray={v === 0 ? '4 4' : undefined}
                      />
                      <line
                        x1={SVG_PAD / 2}
                        y1={toSvgY(v)}
                        x2={SVG_W - SVG_PAD / 2}
                        y2={toSvgY(v)}
                        stroke={v === 0 ? '#cbd5e1' : '#f1f5f9'}
                        strokeWidth={v === 0 ? 1.4 : 1}
                        strokeDasharray={v === 0 ? '4 4' : undefined}
                      />
                    </g>
                  ))}

                {is3D && (
                  <g>
                    {CUBE_EDGES.map(([i, j]) => {
                      const a = project3D({ x: CUBE_CORNERS[i][0], y: CUBE_CORNERS[i][1], z: CUBE_CORNERS[i][2] }, yaw, pitch, zoom)
                      const b = project3D({ x: CUBE_CORNERS[j][0], y: CUBE_CORNERS[j][1], z: CUBE_CORNERS[j][2] }, yaw, pitch, zoom)
                      return (
                        <line
                          key={`${i}-${j}`}
                          x1={a.sx}
                          y1={a.sy}
                          x2={b.sx}
                          y2={b.sy}
                          stroke="#cbd5e1"
                          strokeWidth="1"
                          strokeDasharray="3 4"
                        />
                      )
                    })}
                    {[
                      { label: 'X', color: '#ef4444', v: { x: 1.12, y: 0, z: 0 } },
                      { label: 'Y', color: '#10b981', v: { x: 0, y: 1.12, z: 0 } },
                      { label: 'Z', color: '#3b82f6', v: { x: 0, y: 0, z: 1.12 } },
                    ].map((axis) => {
                      const o = project3D({ x: 0, y: 0, z: 0 }, yaw, pitch, zoom)
                      const e = project3D(axis.v, yaw, pitch, zoom)
                      return (
                        <g key={axis.label}>
                          <line x1={o.sx} y1={o.sy} x2={e.sx} y2={e.sy} stroke={axis.color} strokeWidth="1.8" opacity="0.7" />
                          <text x={e.sx + 4} y={e.sy - 4} fontSize="12" fontWeight="800" fill={axis.color}>
                            {axis.label}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                )}

                {/* Glowing neighbor lines for the selected word */}
                {selectedObj &&
                  neighbors.map((n) => {
                    const from = projectPoint(selectedObj)
                    const to = projectPoint(n)
                    return (
                      <line
                        key={n.word}
                        x1={from.sx}
                        y1={from.sy}
                        x2={to.sx}
                        y2={to.sy}
                        stroke="#f43f5e"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        opacity="0.75"
                        style={{ filter: 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.7))' }}
                      />
                    )
                  })}

                {/* Word Math vectors (revealed step by step) */}
                {mathResult &&
                  (() => {
                    const pA = projectPoint(mathResult.vecA)
                    const pB = projectPoint(mathResult.vecB)
                    const pC = projectPoint(mathResult.vecC)
                    const pR = projectPoint(mathResult.resultVec)
                    const midAB = { x: (pA.sx + pB.sx) / 2, y: (pA.sy + pB.sy) / 2 }
                    const midCR = { x: (pC.sx + pR.sx) / 2, y: (pC.sy + pR.sy) / 2 }

                    // Offset arrow pills perpendicularly outward from the parallelogram so they stay clear of word dots & labels
                    const dx = pA.sx - pB.sx
                    const dy = pA.sy - pB.sy
                    const len = Math.hypot(dx, dy) || 1
                    let nx = -dy / len
                    let ny = dx / len
                    const toOther = (midCR.x - midAB.x) * nx + (midCR.y - midAB.y) * ny
                    if (toOther > 0) {
                      nx = -nx
                      ny = -ny
                    }
                    const pillOffset = is3D ? 28 : 22
                    const labelAB = offsetLabel
                    const labelCR = `same ${offsetLabel.toLowerCase()}`
                    const labelABW = labelAB.length * 6.2 + 16
                    const labelCRW = labelCR.length * 5.9 + 16
                    const clampX = (x, w) => Math.max(w / 2 + 8, Math.min(SVG_W - w / 2 - 8, x))
                    const clampY = (y) => Math.max(14, Math.min(SVG_H - 14, y))
                    const pillAB = {
                      x: clampX(midAB.x + nx * pillOffset, labelABW),
                      y: clampY(midAB.y + ny * pillOffset),
                    }
                    const pillCR = {
                      x: clampX(midCR.x - nx * pillOffset, labelCRW),
                      y: clampY(midCR.y - ny * pillOffset),
                    }

                    return (
                      <g>
                        {mathStep >= 1 && (
                          <circle cx={pA.sx} cy={pA.sy} r="15" fill="rgba(245,158,11,0.14)" stroke="#f59e0b" strokeWidth="2" />
                        )}
                        {mathStep >= 2 && (
                          <g>
                            <line
                              x1={pB.sx}
                              y1={pB.sy}
                              x2={pA.sx}
                              y2={pA.sy}
                              stroke="#f59e0b"
                              strokeWidth="3"
                              className="embedding-vector-animated"
                              markerEnd="url(#arrow-rel)"
                            />
                            <rect x={pillAB.x - labelABW / 2} y={pillAB.y - 9} width={labelABW} height="18" rx="9" fill="#fffbeb" stroke="#f59e0b" />
                            <text x={pillAB.x} y={pillAB.y + 4} textAnchor="middle" fontSize="10.2" fontWeight="700" fill="#b45309">
                              {labelAB}
                            </text>
                          </g>
                        )}
                        {mathStep >= 3 && (
                          <g>
                            <line
                              x1={pC.sx}
                              y1={pC.sy}
                              x2={pR.sx}
                              y2={pR.sy}
                              stroke="#7c3aed"
                              strokeWidth="3.2"
                              strokeDasharray="8 5"
                              className="embedding-vector-animated"
                              markerEnd="url(#arrow-target)"
                            />
                            <rect x={pillCR.x - labelCRW / 2} y={pillCR.y - 9} width={labelCRW} height="18" rx="9" fill="#f5f3ff" stroke="#7c3aed" />
                            <text x={pillCR.x} y={pillCR.y + 4} textAnchor="middle" fontSize="10.2" fontWeight="700" fill="#5b21b6">
                              {labelCR}
                            </text>
                            <circle cx={pR.sx} cy={pR.sy} r="13" fill="rgba(124,58,237,0.14)" stroke="#7c3aed" strokeWidth="2" strokeDasharray="4 3" />
                            <text x={pR.sx} y={pR.sy + 5} textAnchor="middle" fontSize="15" fill="#7c3aed">
                              ★
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })()}

                {/* Word points (depth sorted: far first) */}
                {mapNodes.map(({ item, sx, sy, depth, persp }) => {
                  const catColor = CATEGORY_META[item.category]?.color || '#64748b'
                  const isHovered = hoveredWord?.word === item.word
                  const isSelected = selectedWord === item.word
                  const isMathInput =
                    mathResult &&
                    (item.word === mathResult.inputs.a.word ||
                      item.word === mathResult.inputs.b.word ||
                      item.word === mathResult.inputs.c.word)
                  const isWinner = mathStep >= 4 && mathResult?.bestMatch?.word === item.word
                  const isNeighbor = neighbors.some((n) => n.word === item.word)
                  const isDimmed =
                    activeCategory !== 'all' &&
                    item.category !== activeCategory &&
                    !isMathInput &&
                    !isWinner &&
                    !isSelected
                  const depthT = is3D ? Math.max(0, Math.min(1, (depth + 1.2) / 2.4)) : 1
                  const depthOpacity = is3D ? 0.42 + 0.58 * depthT : 1
                  const emphasized = isHovered || isWinner || isMathInput || isSelected || isNeighbor
                  const baseR = emphasized ? 8.5 : 6.5
                  const r = baseR * (is3D ? persp : 1)
                  const fontSize = (emphasized ? 11.5 : 10.2) * (is3D ? Math.max(0.78, persp) : 1)
                  const showLabel = !is3D || (visible3DLabels && visible3DLabels.has(item.word))

                  return (
                    <g
                      key={item.word}
                      className="embedding-node"
                      opacity={isDimmed ? 0.18 : depthOpacity}
                      onMouseEnter={() => setHoveredWord(item)}
                      onMouseLeave={() => setHoveredWord(null)}
                      onClick={() => {
                        if (dragRef.current?.moved) return
                        playClick()
                        setSelectedWord((prev) => (prev === item.word ? null : item.word))
                      }}
                    >
                      <title>{`${item.emoji} ${item.word} ${fmtVec(item)}`}</title>
                      {(isWinner || isSelected) && (
                        <circle
                          cx={sx}
                          cy={sy}
                          r={r + 8}
                          fill="none"
                          stroke={isSelected ? '#f43f5e' : '#7c3aed'}
                          strokeWidth="2.5"
                          opacity="0.75"
                        />
                      )}
                      <circle
                        cx={sx}
                        cy={sy}
                        r={r}
                        fill={catColor}
                        stroke={isWinner ? '#7c3aed' : isMathInput ? '#0f172a' : '#ffffff'}
                        strokeWidth={isWinner || isMathInput ? 2.5 : 1.8}
                        className="embedding-node-circle"
                      />
                      {showLabel && (
                        <text
                          x={sx}
                          y={sy - r - 4}
                          textAnchor="middle"
                          fontSize={fontSize}
                          fontWeight={emphasized ? '800' : '600'}
                          fill={isWinner ? '#5b21b6' : '#0f172a'}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {item.emoji} {item.word}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            {is3D && (
              <div className="cloud-controls">
                <span className="cloud-hint">🖱️ Drag to rotate</span>
                <button
                  type="button"
                  className={`btn btn-sm ${autoSpin ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    playClick()
                    setAutoSpin((v) => !v)
                  }}
                >
                  {autoSpin ? '⏸ Auto-Spin ON' : '▶ Auto-Spin'}
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={resetView}>
                  ↺ Reset View
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCamera(0, 0)}>
                  Front
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCamera(Math.PI / 2, 0)}>
                  Side
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCamera(0, 1.3)}>
                  Top
                </button>
                <label className="cloud-zoom">
                  Zoom
                  <input
                    type="range"
                    min="0.7"
                    max="1.6"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </label>
              </div>
            )}

            <div className="embedding-hover-bar">
              {infoWord ? (
                <>
                  <span>
                    <strong>
                      {infoWord.emoji} {infoWord.word}
                    </strong>{' '}
                    <span className="badge badge-subtle" style={{ marginLeft: 6 }}>
                      {CATEGORY_META[infoWord.category]?.label}
                    </span>
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    vector: {fmtVec(infoWord)}
                  </span>
                </>
              ) : (
                <span>
                  Hover a dot to see its <strong>{is3D ? '[x, y, z]' : '[x, y]'} coordinates</strong>. Click to light up its 3 nearest neighbors.
                </span>
              )}
            </div>

            {selectedObj && neighbors.length > 0 && (
              <div className="neighbor-bar">
                <strong>Nearest to {selectedObj.emoji} {selectedObj.word}:</strong>
                {neighbors.map((n) => (
                  <span key={n.word} className="neighbor-chip">
                    {n.emoji} {n.word} <span className="font-mono">d={n.distance.toFixed(2)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Step-by-step Word Math */}
          <div className="word-math-panel">
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 4 }}>Word Math Calculator</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Pick a classic analogy or build your own! The amber arrow measures <strong>A − B</strong>, and the purple dashed copy slides that <em>exact</em> arrow onto <strong>C</strong>.
              </p>
            </div>

            <div className="word-math-presets">
              {WORD_MATH_PRESETS.map((preset) => {
                const isActive = wordA === preset.a && wordB === preset.b && wordC === preset.c
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={`preset-chip ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      playClick()
                      setWordA(preset.a)
                      setWordB(preset.b)
                      setWordC(preset.c)
                    }}
                  >
                    {preset.label} = ?
                  </button>
                )
              })}
            </div>

            <div className="word-math-equation">
              {[
                { id: 'word-math-a', label: 'Start (A)', value: wordA, set: setWordA },
                { op: '−' },
                { id: 'word-math-b', label: 'Subtract (B)', value: wordB, set: setWordB },
                { op: '+' },
                { id: 'word-math-c', label: 'Add (C)', value: wordC, set: setWordC },
              ].map((cell, i) =>
                cell.op ? (
                  <span key={`op-${i}`} className="word-math-op" aria-hidden="true">
                    {cell.op}
                  </span>
                ) : (
                  <div key={cell.id} className="word-select-wrap">
                    <label htmlFor={cell.id} className="word-select-label">
                      {cell.label}
                    </label>
                    <select
                      id={cell.id}
                      className="word-select"
                      value={cell.value}
                      onChange={(e) => cell.set(e.target.value)}
                    >
                      {sortedWords.map((w) => (
                        <option key={w.word} value={w.word}>
                          {w.emoji} {w.word}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
              )}
            </div>

            {mathResult && (
              <>
                {/* Stepper */}
                <div className="math-stepper" role="group" aria-label="Step through the math">
                  {[
                    { s: 1, label: 'Step 1' },
                    { s: 2, label: 'Step 2' },
                    { s: 3, label: 'Step 3' },
                    { s: 4, label: 'All Steps' },
                  ].map((b) => (
                    <button
                      key={b.s}
                      type="button"
                      className={`math-step-btn ${mathStep === b.s ? 'is-active' : ''}`}
                      onClick={() => handleStep(b.s)}
                    >
                      {b.label}
                    </button>
                  ))}
                  <button type="button" className="math-step-btn is-replay" onClick={handleReplay}>
                    ↻ Replay
                  </button>
                </div>

                {/* Concrete coordinate arithmetic */}
                <div className="math-steps">
                  <div className={`math-step-card ${mathStep >= 1 ? 'is-on' : ''}`}>
                    <span className="math-step-num">1</span>
                    <div>
                      <div className="math-step-title">Start at A</div>
                      <div className="math-step-eq font-mono">
                        {mathResult.inputs.a.word} = {fmtVec(mathResult.vecA)}
                      </div>
                    </div>
                  </div>

                  <div className={`math-step-card ${mathStep >= 2 ? 'is-on' : ''}`}>
                    <span className="math-step-num">2</span>
                    <div>
                      <div className="math-step-title">
                        Subtract B → the Meaning Arrow{' '}
                        <span className="math-offset-badge">➡️ {offsetLabel}</span>
                      </div>
                      <div className="math-step-eq font-mono">
                        {mathResult.inputs.a.word} − {mathResult.inputs.b.word} = {fmtVec(mathResult.diffVec)}
                      </div>
                    </div>
                  </div>

                  <div className={`math-step-card ${mathStep >= 3 ? 'is-on' : ''}`}>
                    <span className="math-step-num">3</span>
                    <div>
                      <div className="math-step-title">Slide that EXACT arrow onto C</div>
                      <div className="math-step-eq font-mono">
                        {mathResult.inputs.c.word} + {fmtVec(mathResult.diffVec)} = {fmtVec(mathResult.resultVec)} ★
                      </div>
                    </div>
                  </div>

                  <div className={`math-step-card ${mathStep >= 4 ? 'is-on' : ''}`}>
                    <span className="math-step-num">4</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="math-step-title">Nearest Word Match</div>
                      {mathStep >= 4 ? (
                        <div className="word-math-results">
                          {mathResult.matches.map((res, idx) => {
                            const pct = Math.round(res.similarity * 100)
                            return (
                              <div key={res.word} className={`match-row ${idx === 0 ? 'is-winner' : ''}`}>
                                <div className="match-row-top">
                                  <span className="match-word">
                                    <span>{idx === 0 ? '🏆' : `#${idx + 1}`}</span>
                                    <span>{res.emoji}</span>
                                    <span>{res.word}</span>
                                  </span>
                                  <span className="match-pct">
                                    {pct}% · d = {res.distance.toFixed(2)}
                                  </span>
                                </div>
                                <div className="match-bar-track">
                                  <div className="match-bar-fill" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="math-step-eq" style={{ color: 'var(--text-muted)' }}>
                          Click &ldquo;All Steps&rdquo; to reveal the closest words.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {isDeepDive && (
              <div className="callout-deep" style={{ fontSize: '0.84rem' }}>
                <strong>Vector Space Geometry:</strong> Real embeddings use 768 to 12,288+ dimensions instead of {is3D ? '3' : '2'}. Relationships like <em>gender</em>, <em>capital-of</em>, or <em>age</em> emerge as parallel directions: <code>v(king) − v(man) + v(woman) ≈ v(queen)</code>.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 3: SELF-ATTENTION SPOTLIGHT
         ================================================================ */}
      <section className="lab-card lang-section" aria-labelledby="section-attention-title">
        <div className="lang-section-head">
          <div>
            <div className="lang-section-title-row">
              <span className="lang-section-num">3</span>
              <h2 id="section-attention-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Eye size={20} color="#7c3aed" />
                Self-Attention Spotlight
              </h2>
            </div>
            <p className="lang-section-desc">
              Words are <strong>chameleons</strong>! Alone, a word like <strong>&ldquo;it&rdquo;</strong> or{' '}
              <strong>&ldquo;bank&rdquo;</strong> is blurry and ambiguous. <TermTip id="attention">Self-Attention</TermTip> is how
              each word scans the rest of the sentence to borrow context and figure out what it means <em>right now</em>!
            </p>
          </div>
        </div>

        {/* Pair tabs + 1-word flip toggle */}
        <div className="attn-pair-tabs" role="tablist" aria-label="Attention example pairs">
          {ATTENTION_PAIRS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activePair.id === p.id}
              className={`attention-ex-btn ${activePair.id === p.id ? 'is-active' : ''}`}
              onClick={() => handleSelectPair(p)}
            >
              {p.emoji} {p.title}
            </button>
          ))}
        </div>

        <div className="attn-flip-bar">
          <div className="attn-flip-sentence">
            {activePair.prefix}{' '}
            <span className="attn-flip-word">{activeFlipWord}</span>
            {activePair.suffix ? ` ${activePair.suffix}` : ''}
          </div>
          <div className="attn-flip-controls">
            <span className="attn-flip-label">Flip ONE word:</span>
            {activePair.options.map((opt) => (
              <button
                key={opt.exampleId}
                type="button"
                className={`attn-flip-btn ${activeExample.id === opt.exampleId ? 'is-active' : ''}`}
                onClick={() => handleFlip(opt.exampleId)}
              >
                {opt.word}
              </button>
            ))}
            <button type="button" className="btn btn-sm btn-primary" onClick={handleFlipToggle}>
              {activePair.options[0].word} ⇄ {activePair.options[1].word}
            </button>
          </div>
        </div>

        {/* Interactive Attention Arc Stage */}
        <div className="attention-stage">
          <div className="attention-stage-hint">
            <span>
              Active Query Word:{' '}
              <strong style={{ color: '#c4b5fd' }}>
                &ldquo;{activeExample.tokens[queryIndex]}&rdquo;
              </strong>{' '}
              — click any word below to move the spotlight!
            </span>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>
              Thicker, brighter arcs = stronger attention
            </span>
          </div>

          <div className="attention-svg-container">
            <svg
              viewBox={`0 0 ${arcSvgWidth} ${arcSvgHeight}`}
              className="attention-svg"
              role="img"
              aria-label={`Self-attention arcs from ${activeExample.tokens[queryIndex]} to other words`}
            >
              <defs>
                <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {activeWeights.map((weight, targetIdx) => {
                if (targetIdx === queryIndex || weight < 0.04) return null
                const x1 = tokenCenterX(queryIndex)
                const x2 = tokenCenterX(targetIdx)
                const midX = (x1 + x2) / 2
                const distance = Math.abs(targetIdx - queryIndex)
                const arcHeight = Math.min(arcSvgHeight - 24, 34 + distance * 13)
                const ctrlY = arcSvgHeight - arcHeight
                const isStrong = weight >= 0.22
                const strokeWidth = Math.max(1.2, weight * 14)
                const opacity = Math.min(1, 0.2 + weight * 1.4)

                return (
                  <g key={targetIdx}>
                    <path
                      d={`M ${x1} ${arcSvgHeight - 4} Q ${midX} ${ctrlY} ${x2} ${arcSvgHeight - 4}`}
                      fill="none"
                      stroke={isStrong ? '#38bdf8' : '#a78bfa'}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      opacity={opacity}
                      filter={isStrong ? 'url(#arc-glow)' : undefined}
                    />
                    {weight >= 0.16 && (
                      <g>
                        <rect
                          x={midX - 20}
                          y={ctrlY + arcHeight * 0.34 - 11}
                          width="40"
                          height="19"
                          rx="9"
                          fill="#1e293b"
                          stroke={isStrong ? '#38bdf8' : '#a78bfa'}
                          strokeWidth="1.2"
                        />
                        <text
                          x={midX}
                          y={ctrlY + arcHeight * 0.34 + 2}
                          textAnchor="middle"
                          fontSize="10.5"
                          fontWeight="700"
                          fontFamily="var(--font-mono)"
                          fill="#f8fafc"
                        >
                          {Math.round(weight * 100)}%
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          <div
            className="attention-tokens-row"
            style={{ gridTemplateColumns: `repeat(${tokenCount}, minmax(0, 1fr))` }}
          >
            {activeExample.tokens.map((tok, idx) => {
              const weight = activeWeights[idx] || 0
              const pct = Math.round(weight * 100)
              const isQuery = idx === queryIndex
              const isStrongTarget = !isQuery && weight >= 0.22

              return (
                <button
                  key={`${tok}-${idx}`}
                  type="button"
                  className={`attention-token-btn ${isQuery ? 'is-query' : ''} ${
                    isStrongTarget ? 'is-strong-target' : ''
                  }`}
                  onClick={() => {
                    playClick()
                    setQueryIndex(idx)
                  }}
                  aria-pressed={isQuery}
                >
                  <span className="attention-token-word">{tok}</span>
                  <span className="attention-token-weight">{pct}%</span>
                  <span className="attention-mini-bar" aria-hidden="true">
                    <span
                      className="attention-mini-bar-fill"
                      style={{ width: `${Math.min(100, pct * 1.4)}%` }}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Explorer Explanation */}
        <div className="callout-kid">
          <strong>
            {queryIndex === activeExample.focusIndex
              ? `Why does "${activeExample.tokens[queryIndex]}" look at "${activeExample.tokens[activeExample.referentIndex]}" here?`
              : `Spotlight on "${activeExample.tokens[queryIndex]}":`}
          </strong>{' '}
          {queryIndex === activeExample.focusIndex
            ? activeExample.explanation
            : `When the model reads "${activeExample.tokens[queryIndex]}", it looks most strongly at "${
                topAttentionLinks[0]?.token || ''
              }" (${Math.round((topAttentionLinks[0]?.weight || 0) * 100)}%). Click "${
                activeExample.tokens[activeExample.focusIndex]
              }" to see the classic puzzle!`}
        </div>

        {/* 3-Step: How Attention Actually Works */}
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>
            How Attention Actually Works for &ldquo;{queryWord}&rdquo;
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Click any word above or flip the context word — these 3 steps update live!
          </p>
        </div>

        <div className="attn-steps">
          <div className="attn-step-card">
            <span className="attn-step-pill">Step 1 · Ask a Question (Query / Q)</span>
            <p className="attn-step-main">&ldquo;{queryQuestion}&rdquo;</p>
            <p className="attn-step-note">
              Every word sends out a question asking what clues it needs.
            </p>
          </div>

          <div className="attn-step-card">
            <span className="attn-step-pill">Step 2 · Check Every Nametag (Keys / K → Match %)</span>
            <div className="attn-nametags">
              {top4Links.map((link) => (
                <div key={link.idx} className="attn-nametag">
                  <span className="attn-nametag-word">{link.token}</span>
                  <span className="attn-nametag-track">
                    <span
                      className="attn-nametag-fill"
                      style={{ width: `${Math.min(100, Math.round(link.weight * 100) * 1.6)}%`, background: RECIPE_COLORS[top4Links.indexOf(link)] }}
                    />
                  </span>
                  <span className="attn-nametag-pct">{Math.round(link.weight * 100)}%</span>
                </div>
              ))}
            </div>
            <p className="attn-step-note">
              Better matches get thicker, brighter arcs. All weights add up to 100% thanks to{' '}
              <TermTip id="softmax">Softmax</TermTip>.
            </p>
          </div>

          <div className="attn-step-card attn-step-card-wide">
            <div className="attn-step-head-row">
              <span className="attn-step-pill">Step 3 · Mix a Context-Aware Meaning (Values / V)</span>
              <button
                type="button"
                className={`btn btn-sm ${attentionOn ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => {
                  playClick()
                  setAttentionOn((v) => !v)
                }}
              >
                <Eye size={14} />
                <span>{attentionOn ? 'Compare: Turn Attention OFF' : 'Turn Attention back ON'}</span>
              </button>
            </div>

            <div className="attn-ba-grid">
              <div className="attn-ba-box is-before">
                <span className="attn-ba-label">Before Attention</span>
                <strong className="attn-ba-word">{queryWord}</strong>
                <span className="attn-ba-text">{meaning.before}</span>
              </div>

              <div className="attn-ba-arrow" aria-hidden="true">→</div>

              <div className="attn-ba-box is-recipe">
                <span className="attn-ba-label">Attention Recipe (Weighted Blend)</span>
                <div className="attn-recipe-bar">
                  {attentionOn ? (
                    <>
                      {top4Links.slice(0, 3).map((link, i) => (
                        <span
                          key={link.idx}
                          className="attn-recipe-seg"
                          style={{ flexGrow: Math.max(1, link.weight * 100), background: RECIPE_COLORS[i] }}
                          title={`${Math.round(link.weight * 100)}% ${link.token}`}
                        >
                          {Math.round(link.weight * 100)}% {link.token}
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="attn-recipe-seg is-off" style={{ flexGrow: 1 }}>
                      attention off — no blending
                    </span>
                  )}
                </div>
              </div>

              <div className="attn-ba-arrow" aria-hidden="true">→</div>

              <div className={`attn-ba-box is-after ${attentionOn ? 'is-on' : ''}`}>
                <span className="attn-ba-label">After Attention</span>
                <strong className="attn-ba-word">{queryWord}{attentionOn ? '′' : ''}</strong>
                <span className="attn-ba-text">{attentionOn ? meaning.after : meaning.before}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Head Attention Mini-Insight */}
        <div className="attn-heads">
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>
            Real Transformers run many attention <em>heads</em> at the same time:
          </div>
          <div className="attn-heads-grid">
            {ATTENTION_HEADS.map((h) => (
              <div key={h.name} className="attn-head-pill">
                <span className="attn-head-emoji">{h.emoji}</span>
                <span>
                  <strong>{h.name}</strong>
                  <span className="attn-head-desc"> — {h.desc}</span>
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            Each head draws its own spotlight, and their findings are combined — like a team of detectives each watching a different clue!
          </p>
        </div>

        {/* Deep-Dive Q / K / V Note */}
        <div className="callout-deep">
          <strong>{isDeepDive ? 'Deep-Dive — Queries, Keys & Values (Q, K, V):' : 'Peek Under the Hood (Q, K, V):'}</strong>{' '}
          Every token creates three vectors: a <strong>Query (Q)</strong> (&ldquo;what clue am I looking for?&rdquo;), a <strong>Key (K)</strong> (&ldquo;what clue do I offer?&rdquo;), and a <strong>Value (V)</strong> (&ldquo;my meaning to share&rdquo;). The model compares each Query against all Keys, turns the scores into percentages with softmax, and blends the Values together!
          {isDeepDive && (
            <div className="formula-box" style={{ marginTop: 10 }}>
              Attention(Q, K, V) = softmax( (Q · Kᵀ) / √d_k ) · V
            </div>
          )}
        </div>
      </section>

      {/* Footer Navigation */}
      <nav className="lab-footer-nav" aria-label="Stage navigation">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/stage/4')}
        >
          <ArrowLeft size={16} />
          <span>Stage 4: How Computers See</span>
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
            onClick={handleMarkComplete}
          >
            <CheckCircle2 size={16} />
            <span>{isDone ? 'Stage 5 Completed' : 'Mark Stage 5 Complete'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/stage/6')}
          >
            <span>Next: Stage 6 →</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>
    </div>
  )
}
