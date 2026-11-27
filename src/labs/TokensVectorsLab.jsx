import { useMemo, useState } from 'react'
import {
  EMBEDDING_WORDS,
  WORD_MATH_PRESETS,
  findNearestWords,
  tokenize,
  wordMath,
} from '../engine/miniLlm.js'
import { playClick } from '../utils/sound.js'
import BookChapter, { BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './LanguageLab.css'

const TOKEN_PRESETS = [
  'Unbelievable robots are learning!',
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
const SVG_H = 390
const SVG_PAD = 42
const toSvgX = (x) => SVG_PAD + ((x + 1) / 2) * (SVG_W - SVG_PAD * 2)
const toSvgY = (y) => SVG_H - SVG_PAD - ((y + 1) / 2) * (SVG_H - SVG_PAD * 2)

export default function TokensVectorsLab() {
  // Demo 5A: Token Chunker
  const [inputText, setInputText] = useState(TOKEN_PRESETS[0])
  const tokens = useMemo(() => tokenize(inputText), [inputText])
  const subwordCount = useMemo(
    () => tokens.filter((t) => t.type === 'prefix' || t.type === 'suffix').length,
    [tokens],
  )

  // Demo 5B: Clean 2D Meaning Map & Word Math
  const [selectedWord, setSelectedWord] = useState(null)
  const [hoveredWord, setHoveredWord] = useState(null)
  const [presetIdx, setPresetIdx] = useState(0)

  const activePreset = WORD_MATH_PRESETS[presetIdx] || WORD_MATH_PRESETS[0]
  const mathResult = useMemo(() => {
    try {
      return wordMath(activePreset.a, activePreset.b, activePreset.c, { topN: 3, use3D: false })
    } catch {
      return null
    }
  }, [activePreset])

  const neighbors = useMemo(
    () => (selectedWord ? findNearestWords(selectedWord, 3, false) : []),
    [selectedWord],
  )
  const selectedObj = selectedWord ? EMBEDDING_WORDS.find((w) => w.word === selectedWord) : null
  const infoWord = hoveredWord || selectedObj

  return (
    <BookChapter
      chapterId={5}
      recapFromPrev="In Chapter 4, computers turned pictures into grids of numbers. Now let’s see how AI turns human words into numbers!"
      cliffhangerTitle="Wait — what if ONE word has TWO totally different meanings?"
      cliffhangerText="Every word now has a GPS spot on the Meaning Map. But what about chameleon words like 'bank' (a muddy river bank vs. a money bank) or 'it'? A single fixed coordinate can't tell them apart — which is why Transformers invented the Attention Spotlight in Chapter 6!"
    >
      {/* Beat 1: Token Chunker */}
      <BookSection num="1" title="Chop Sentences into Numbered Lego Bricks" id="ch5-tokens">
        <p className="book-prose">
          Computers can’t read English letters directly — they need ID numbers. Instead of memorizing
          every rare word on Earth, modern AI snaps text into reusable Lego pieces called{' '}
          <TermTip id="token">tokens</TermTip>. Common words stay whole, while long words split into
          familiar parts like <code>Un</code> + <code>believable</code>.
        </p>

        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="token-presets" role="group" aria-label="Preset sentences">
            <span className="token-preset-label">Try a sentence:</span>
            {TOKEN_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset-chip ${inputText === preset ? 'is-active' : ''}`}
                onClick={() => {
                  playClick()
                  setInputText(preset)
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="token-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Or type your own sentence here..."
            aria-label="Sentence to tokenize"
          />

          <div className="token-tray" aria-live="polite">
            {tokens.map((tok, idx) => {
              const palette = TOKEN_PALETTE[tok.colorIndex % TOKEN_PALETTE.length]
              const isSpace = tok.type === 'space'
              return (
                <div key={`${tok.id}-${idx}`} className="token-brick">
                  <span
                    className={`token-pill ${isSpace ? 'is-space' : ''}`}
                    style={{
                      background: isSpace ? '#f1f5f9' : palette.bg,
                      borderColor: isSpace ? '#cbd5e1' : palette.border,
                      color: isSpace ? '#64748b' : palette.text,
                    }}
                  >
                    {isSpace ? '␣' : tok.text}
                  </span>
                  <div className="token-meta">
                    <span className="token-id">#{tok.id}</span>
                    {(tok.type === 'prefix' || tok.type === 'suffix') && (
                      <span className="token-type-tag">{tok.type}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="book-takeaway" style={{ fontSize: '0.88rem' }}>
            Your text became <strong>{tokens.length} numbered tokens</strong>
            {subwordCount > 0 ? ` (including ${subwordCount} reusable prefix/suffix pieces)` : ''}.
          </div>

          <MathDrawer title="Peek at the Math: Subword Vocabularies (BPE)">
            <p>
              Real LLMs (like Gemini or GPT) learn a vocabulary of 50,000–256,000 subword tokens
              using Byte-Pair Encoding (BPE), so even brand-new or invented words break cleanly into
              known IDs.
            </p>
          </MathDrawer>
        </div>
      </BookSection>

      {/* Beat 2: 2D Meaning Map & Word Math */}
      <BookSection num="2" title="Place Every Word on a Meaning Map" id="ch5-vectors">
        <p className="book-prose">
          A Token ID like <code>#412</code> is just a locker number — it doesn’t tell the AI that{' '}
          <em>cat</em> and <em>dog</em> are similar! So the AI gives every token a GPS coordinate
          called an <TermTip id="embedding">embedding</TermTip>.
        </p>
        <p className="book-prose">
          Words with similar meanings live in the same neighborhood — and even better,{' '}
          <strong>directions on the map carry meaning</strong>! Pick an analogy below and watch how
          sliding the exact same arrow solves word math:
        </p>

        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Clean 4-Analogy Preset Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Try Word Math:
            </span>
            {WORD_MATH_PRESETS.map((preset, idx) => (
              <button
                key={preset.label}
                type="button"
                className={`preset-chip ${presetIdx === idx ? 'is-active' : ''}`}
                onClick={() => {
                  playClick()
                  setPresetIdx(idx)
                }}
              >
                {preset.label} = ?
              </button>
            ))}
          </div>

          <div className="embedding-layout">
            {/* Left: Clean 2D Map */}
            <div className="embedding-map-card">
              <div className="embedding-svg-wrap">
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="embedding-svg"
                  role="img"
                  aria-label="2D word embedding meaning map"
                >
                  <defs>
                    <marker id="arrow-rel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                    </marker>
                    <marker id="arrow-target" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
                    </marker>
                  </defs>

                  {[-0.5, 0, 0.5].map((v) => (
                    <g key={v}>
                      <line x1={toSvgX(v)} y1={20} x2={toSvgX(v)} y2={SVG_H - 20} stroke={v === 0 ? '#cbd5e1' : '#f1f5f9'} strokeDasharray={v === 0 ? '4 4' : undefined} />
                      <line x1={20} y1={toSvgY(v)} x2={SVG_W - 20} y2={toSvgY(v)} stroke={v === 0 ? '#cbd5e1' : '#f1f5f9'} strokeDasharray={v === 0 ? '4 4' : undefined} />
                    </g>
                  ))}

                  {/* Parallel analogy arrows */}
                  {mathResult && (() => {
                    const pA = { sx: toSvgX(mathResult.vecA.x), sy: toSvgY(mathResult.vecA.y) }
                    const pB = { sx: toSvgX(mathResult.vecB.x), sy: toSvgY(mathResult.vecB.y) }
                    const pC = { sx: toSvgX(mathResult.vecC.x), sy: toSvgY(mathResult.vecC.y) }
                    const pR = { sx: toSvgX(mathResult.resultVec.x), sy: toSvgY(mathResult.resultVec.y) }
                    return (
                      <g>
                        <line x1={pB.sx} y1={pB.sy} x2={pA.sx} y2={pA.sy} stroke="#f59e0b" strokeWidth="3" className="embedding-vector-animated" markerEnd="url(#arrow-rel)" />
                        <line x1={pC.sx} y1={pC.sy} x2={pR.sx} y2={pR.sy} stroke="#7c3aed" strokeWidth="3.2" strokeDasharray="7 4" className="embedding-vector-animated" markerEnd="url(#arrow-target)" />
                        <circle cx={pR.sx} cy={pR.sy} r="13" fill="rgba(124,58,237,0.14)" stroke="#7c3aed" strokeWidth="2" strokeDasharray="4 3" />
                      </g>
                    )
                  })()}

                  {/* Neighbor lines */}
                  {selectedObj &&
                    neighbors.map((n) => (
                      <line
                        key={`nb-${n.word}`}
                        x1={toSvgX(selectedObj.x)}
                        y1={toSvgY(selectedObj.y)}
                        x2={toSvgX(n.x)}
                        y2={toSvgY(n.y)}
                        stroke="#f43f5e"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    ))}

                  {EMBEDDING_WORDS.map((item) => {
                    const sx = toSvgX(item.x)
                    const sy = toSvgY(item.y)
                    const catColor = CATEGORY_META[item.category]?.color || '#64748b'
                    const isInput =
                      mathResult &&
                      (item.word === mathResult.inputs.a.word ||
                        item.word === mathResult.inputs.b.word ||
                        item.word === mathResult.inputs.c.word)
                    const isWinner = mathResult?.bestMatch?.word === item.word
                    const isSel = selectedWord === item.word
                    const emphasized = isInput || isWinner || isSel || hoveredWord?.word === item.word
                    return (
                      <g
                        key={item.word}
                        className="embedding-node"
                        onMouseEnter={() => setHoveredWord(item)}
                        onMouseLeave={() => setHoveredWord(null)}
                        onClick={() => {
                          playClick()
                          setSelectedWord((prev) => (prev === item.word ? null : item.word))
                        }}
                      >
                        <circle
                          cx={sx}
                          cy={sy}
                          r={emphasized ? 8 : 6}
                          fill={catColor}
                          stroke={isWinner ? '#7c3aed' : isSel ? '#f43f5e' : '#ffffff'}
                          strokeWidth={emphasized ? 2.5 : 1.6}
                        />
                        <text
                          x={sx}
                          y={sy - 11}
                          textAnchor="middle"
                          fontSize={emphasized ? 11.5 : 10}
                          fontWeight={emphasized ? '800' : '600'}
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
                {infoWord ? (
                  <span>
                    <strong>{infoWord.emoji} {infoWord.word}</strong>{' '}
                    <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      [{infoWord.x.toFixed(2)}, {infoWord.y.toFixed(2)}]
                    </span>
                  </span>
                ) : (
                  <span>Click any word dot to highlight its 3 closest neighbors on the map!</span>
                )}
              </div>
            </div>

            {/* Right: Word Math Result */}
            {mathResult && (
              <div className="word-math-panel">
                <h3 style={{ fontSize: '1.12rem' }}>
                  {mathResult.inputs.a.emoji} {mathResult.inputs.a.word} − {mathResult.inputs.b.emoji} {mathResult.inputs.b.word} + {mathResult.inputs.c.emoji} {mathResult.inputs.c.word}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  The amber arrow measures the meaning jump (<strong>{activePreset.offsetLabel}</strong>). Sliding that <em>exact</em> arrow onto{' '}
                  <strong>{mathResult.inputs.c.word}</strong> lands right next to:
                </p>

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
                          <span className="match-pct">{pct}% match</span>
                        </div>
                        <div className="match-bar-track">
                          <div className="match-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedObj && neighbors.length > 0 && (
                  <div className="neighbor-bar">
                    <strong>Nearest to {selectedObj.emoji} {selectedObj.word}:</strong>
                    {neighbors.map((n) => (
                      <span key={n.word} className="neighbor-chip">
                        {n.emoji} {n.word}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <MathDrawer title="Peek at the Math: Vector Space Geometry">
            <p>
              Our map uses 2 coordinates <code>[x, y]</code> so we can see it on screen. Real LLMs
              use <strong>4,096 to 12,288+ dimensions</strong> per word, allowing thousands of
              concepts (gender, tense, capital cities, tone) to live as parallel vector directions:
            </p>
            <div className="formula-box">
              v(king) − v(man) + v(woman) ≈ v(queen)
            </div>
          </MathDrawer>
        </div>
      </BookSection>
    </BookChapter>
  )
}
