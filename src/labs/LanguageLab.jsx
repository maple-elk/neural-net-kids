import { useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Eye,
  Scissors,
  Sparkles,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById } from '../utils/pathwayLoader.js'
import {
  ATTENTION_EXAMPLES,
  EMBEDDING_WORDS,
  WORD_MATH_PRESETS,
  tokenize,
  wordMath,
} from '../engine/miniLlm.js'
import { playClick, playSuccess } from '../utils/sound.js'
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

const SVG_W = 560
const SVG_H = 420
const SVG_PAD = 42

function toSvgX(x) {
  return SVG_PAD + ((x + 1) / 2) * (SVG_W - SVG_PAD * 2)
}

function toSvgY(y) {
  return SVG_H - SVG_PAD - ((y + 1) / 2) * (SVG_H - SVG_PAD * 2)
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

  // Section 2: 2D Meaning Map & Word Math
  const [activeCategory, setActiveCategory] = useState('all')
  const [hoveredWord, setHoveredWord] = useState(null)
  const [wordA, setWordA] = useState('king')
  const [wordB, setWordB] = useState('man')
  const [wordC, setWordC] = useState('woman')

  const mathResult = useMemo(() => {
    try {
      return wordMath(wordA, wordB, wordC, 3)
    } catch {
      return null
    }
  }, [wordA, wordB, wordC])

  // Section 3: Self-Attention Spotlight
  const [exampleId, setExampleId] = useState(ATTENTION_EXAMPLES[0].id)
  const activeExample = useMemo(
    () => ATTENTION_EXAMPLES.find((ex) => ex.id === exampleId) || ATTENTION_EXAMPLES[0],
    [exampleId],
  )
  const [queryIndex, setQueryIndex] = useState(ATTENTION_EXAMPLES[0].focusIndex)

  const handleSelectExample = (ex) => {
    playClick()
    setExampleId(ex.id)
    setQueryIndex(ex.focusIndex)
  }

  const activeWeights = useMemo(() => {
    const safeIdx = Math.min(queryIndex, activeExample.tokens.length - 1)
    return activeExample.weights[safeIdx] || []
  }, [activeExample, queryIndex])

  const topAttentionLinks = useMemo(() => {
    return activeWeights
      .map((weight, idx) => ({
        idx,
        token: activeExample.tokens[idx],
        weight,
      }))
      .filter((item) => item.idx !== queryIndex)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
  }, [activeWeights, activeExample.tokens, queryIndex])

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

  const trophyExamples = ATTENTION_EXAMPLES.filter((e) => e.pairId === 'trophy')
  const animalExamples = ATTENTION_EXAMPLES.filter((e) => e.pairId === 'animal')

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
              Type any sentence below or tap a preset. Watch how AI splits long words into reusable pieces and gives each piece a numeric Token ID.
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
          SECTION 2: 2D MEANING MAP & WORD MATH
         ================================================================ */}
      <section className="lab-card lang-section" aria-labelledby="section-embeddings-title">
        <div className="lang-section-head">
          <div>
            <div className="lang-section-title-row">
              <span className="lang-section-num">2</span>
              <h2 id="section-embeddings-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Compass size={20} color="#7c3aed" />
                2D Meaning Map &amp; Word Math
              </h2>
            </div>
            <p className="lang-section-desc">
              AI turns every word into coordinates on a Meaning Map. Words with similar meanings live in the same neighborhood—so you can literally do math with meanings!
            </p>
          </div>
        </div>

        <div className="embedding-layout">
          {/* Left: Interactive 2D SVG Scatter Plot */}
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

            <div className="embedding-svg-wrap">
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="embedding-svg"
                role="img"
                aria-label="2D word embedding scatter plot with vector analogy arrows"
              >
                <defs>
                  <marker
                    id="arrow-rel"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                  <marker
                    id="arrow-target"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
                  </marker>
                </defs>

                {/* Subtle Coordinate Grid */}
                {[-0.5, 0, 0.5].map((v) => (
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

                {/* Animated Word Math Vector Arrows */}
                {mathResult && (
                  <g>
                    {/* Vector 1: B -> A (relationship vector A - B) */}
                    <line
                      x1={toSvgX(mathResult.inputs.b.x)}
                      y1={toSvgY(mathResult.inputs.b.y)}
                      x2={toSvgX(mathResult.inputs.a.x)}
                      y2={toSvgY(mathResult.inputs.a.y)}
                      stroke="#f59e0b"
                      strokeWidth="2.8"
                      className="embedding-vector-animated"
                      markerEnd="url(#arrow-rel)"
                    />

                    {/* Vector 2: C -> Target (applying same vector from C) */}
                    <line
                      x1={toSvgX(mathResult.inputs.c.x)}
                      y1={toSvgY(mathResult.inputs.c.y)}
                      x2={toSvgX(mathResult.target.x)}
                      y2={toSvgY(mathResult.target.y)}
                      stroke="#7c3aed"
                      strokeWidth="3.2"
                      className="embedding-vector-animated"
                      markerEnd="url(#arrow-target)"
                    />

                    {/* Target Landing Crosshair */}
                    <circle
                      cx={toSvgX(mathResult.target.x)}
                      cy={toSvgY(mathResult.target.y)}
                      r="14"
                      fill="rgba(124, 58, 237, 0.14)"
                      stroke="#7c3aed"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                  </g>
                )}

                {/* Word Points */}
                {EMBEDDING_WORDS.map((item) => {
                  const cx = toSvgX(item.x)
                  const cy = toSvgY(item.y)
                  const catColor = CATEGORY_META[item.category]?.color || '#64748b'
                  const isHovered = hoveredWord?.word === item.word
                  const isMathInput =
                    mathResult &&
                    (item.word === mathResult.inputs.a.word ||
                      item.word === mathResult.inputs.b.word ||
                      item.word === mathResult.inputs.c.word)
                  const isWinner = mathResult?.bestMatch?.word === item.word
                  const isDimmed =
                    activeCategory !== 'all' &&
                    item.category !== activeCategory &&
                    !isMathInput &&
                    !isWinner

                  return (
                    <g
                      key={item.word}
                      className="embedding-node"
                      opacity={isDimmed ? 0.2 : 1}
                      onMouseEnter={() => setHoveredWord(item)}
                      onMouseLeave={() => setHoveredWord(null)}
                      onClick={() => setHoveredWord(item)}
                    >
                      {isWinner && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r="17"
                          fill="none"
                          stroke="#7c3aed"
                          strokeWidth="2.5"
                          opacity="0.7"
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered || isWinner ? 9 : isMathInput ? 8 : 6.5}
                        fill={catColor}
                        stroke={isWinner ? '#7c3aed' : isMathInput ? '#0f172a' : '#ffffff'}
                        strokeWidth={isWinner || isMathInput ? 2.5 : 1.8}
                        className="embedding-node-circle"
                      />
                      <text
                        x={cx}
                        y={cy - 11}
                        textAnchor="middle"
                        fontSize={isHovered || isWinner || isMathInput ? '11.5' : '10.2'}
                        fontWeight={isHovered || isWinner || isMathInput ? '800' : '600'}
                        fill={isWinner ? '#5b21b6' : '#0f172a'}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {item.emoji} {item.word}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="embedding-hover-bar">
              {hoveredWord ? (
                <>
                  <span>
                    <strong>
                      {hoveredWord.emoji} {hoveredWord.word}
                    </strong>{' '}
                    <span className="badge badge-subtle" style={{ marginLeft: 6 }}>
                      {CATEGORY_META[hoveredWord.category]?.label}
                    </span>
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    vector: ({hoveredWord.x.toFixed(2)}, {hoveredWord.y.toFixed(2)})
                  </span>
                </>
              ) : (
                <span>
                  Hover or tap any dot on the map to inspect its <strong>(x, y) meaning coordinates</strong>.
                </span>
              )}
            </div>
          </div>

          {/* Right: Interactive Word Math Widget */}
          <div className="word-math-panel">
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 4 }}>Word Math Calculator</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Pick a classic analogy or build your own! The amber arrow measures <strong>A − B</strong>, and the purple arrow adds that jump to <strong>C</strong>.
              </p>
            </div>

            <div className="word-math-presets">
              {WORD_MATH_PRESETS.map((preset) => {
                const isActive =
                  wordA === preset.a && wordB === preset.b && wordC === preset.c
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
              <div className="word-select-wrap">
                <label htmlFor="word-math-a" className="word-select-label">
                  Start (A)
                </label>
                <select
                  id="word-math-a"
                  className="word-select"
                  value={wordA}
                  onChange={(e) => setWordA(e.target.value)}
                >
                  {sortedWords.map((w) => (
                    <option key={w.word} value={w.word}>
                      {w.emoji} {w.word}
                    </option>
                  ))}
                </select>
              </div>

              <span className="word-math-op" aria-hidden="true">
                −
              </span>

              <div className="word-select-wrap">
                <label htmlFor="word-math-b" className="word-select-label">
                  Subtract (B)
                </label>
                <select
                  id="word-math-b"
                  className="word-select"
                  value={wordB}
                  onChange={(e) => setWordB(e.target.value)}
                >
                  {sortedWords.map((w) => (
                    <option key={w.word} value={w.word}>
                      {w.emoji} {w.word}
                    </option>
                  ))}
                </select>
              </div>

              <span className="word-math-op" aria-hidden="true">
                +
              </span>

              <div className="word-select-wrap">
                <label htmlFor="word-math-c" className="word-select-label">
                  Add (C)
                </label>
                <select
                  id="word-math-c"
                  className="word-select"
                  value={wordC}
                  onChange={(e) => setWordC(e.target.value)}
                >
                  {sortedWords.map((w) => (
                    <option key={w.word} value={w.word}>
                      {w.emoji} {w.word}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {mathResult && (
              <div className="word-math-results">
                <div className="word-math-results-head">
                  <span>Top-3 Closest Words</span>
                  <span className="font-mono" style={{ fontSize: '0.78rem' }}>
                    target ({mathResult.target.x.toFixed(2)}, {mathResult.target.y.toFixed(2)})
                  </span>
                </div>

                {mathResult.results.map((res, idx) => {
                  const pct = Math.round(res.similarity * 100)
                  return (
                    <div key={res.word} className={`match-row ${idx === 0 ? 'is-winner' : ''}`}>
                      <div className="match-row-top">
                        <span className="match-word">
                          <span>{idx === 0 ? '🏆' : `#${idx + 1}`}</span>
                          <span>{res.emoji}</span>
                          <span>{res.word}</span>
                          <span className="badge badge-subtle" style={{ fontSize: '0.68rem' }}>
                            {CATEGORY_META[res.category]?.label}
                          </span>
                        </span>
                        <span className="match-pct">{pct}% match</span>
                      </div>
                      <div className="match-bar-track">
                        <div className="match-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {isDeepDive && (
              <div className="callout-deep" style={{ fontSize: '0.84rem' }}>
                <strong>Vector Space Geometry:</strong> Real embeddings use 768 to 12,288+ dimensions instead of 2D. Relationships like <em>gender</em>, <em>capital-of</em>, or <em>age</em> emerge as parallel directions: <code>v(king) − v(man) + v(woman) ≈ v(queen)</code>.
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
              Words change meaning depending on their neighbors! Flip just ONE word between each pair below and watch the attention spotlight jump to the right clue.
            </p>
          </div>
        </div>

        {/* Winograd Pair Switcher */}
        <div className="attention-examples-bar">
          <div className="attention-pair-group">
            <span className="attention-pair-label">Pair 1 · Trophy vs. Suitcase</span>
            <div className="attention-pair-btns">
              {trophyExamples.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className={`attention-ex-btn ${activeExample.id === ex.id ? 'is-active' : ''}`}
                  onClick={() => handleSelectExample(ex)}
                >
                  {ex.title}
                </button>
              ))}
            </div>
          </div>

          <div className="attention-pair-group">
            <span className="attention-pair-label">Pair 2 · Animal vs. Street</span>
            <div className="attention-pair-btns">
              {animalExamples.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className={`attention-ex-btn ${activeExample.id === ex.id ? 'is-active' : ''}`}
                  onClick={() => handleSelectExample(ex)}
                >
                  {ex.title}
                </button>
              ))}
            </div>
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

        {/* Explorer Explanation + Top Attention Links */}
        <div className="attention-readout">
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
                }" (${Math.round((topAttentionLinks[0]?.weight || 0) * 100)}%) to understand how these words connect in the sentence. Click "${
                  activeExample.tokens[activeExample.focusIndex]
                }" to see the classic pronoun puzzle!`}
          </div>

          <div className="attention-top-links">
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Strongest Links from &ldquo;{activeExample.tokens[queryIndex]}&rdquo;
            </span>
            {topAttentionLinks.map((link) => (
              <div key={link.idx} className="attention-link-row">
                <span>
                  <Sparkles size={13} color="#7c3aed" style={{ marginRight: 5, verticalAlign: '-2px' }} />
                  &ldquo;{link.token}&rdquo;
                </span>
                <span className="font-mono" style={{ color: '#6d28d9' }}>
                  {Math.round(link.weight * 100)}%
                </span>
              </div>
            ))}
          </div>
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
