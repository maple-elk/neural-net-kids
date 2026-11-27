import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { ATTENTION_EXAMPLES } from '../engine/miniLlm.js'
import { playClick } from '../utils/sound.js'
import BookChapter, { BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './LanguageLab.css'

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

const BANK_RIVER = ['I', 'sat', 'by', 'the', 'river', 'bank', 'to', 'watch', 'the', 'boats']
const BANK_MONEY = ['I', 'went', 'to', 'the', 'city', 'bank', 'to', 'deposit', 'money']

const BANK_EXAMPLES = [
  {
    id: 'bank-river',
    tokens: BANK_RIVER,
    focusIndex: 5,
    referentIndex: 4,
    explanation:
      'Neighbors like "river" and "boats" shout WATER! Attention makes "bank" borrow their meaning, so it becomes a muddy riverside.',
    weights: buildWeights(BANK_RIVER, {
      5: { 4: 0.55, 9: 0.26, 1: 0.12, 5: 0.14 },
      4: { 5: 0.4, 3: 0.2, 4: 0.2 },
      9: { 5: 0.3, 4: 0.3, 9: 0.2 },
    }),
  },
  {
    id: 'bank-money',
    tokens: BANK_MONEY,
    focusIndex: 5,
    referentIndex: 8,
    explanation:
      'Now the neighbors are "deposit", "money", and "city". Same word "bank", totally different meaning — attention swaps the clues!',
    weights: buildWeights(BANK_MONEY, {
      5: { 8: 0.5, 7: 0.32, 4: 0.22, 5: 0.14 },
      7: { 8: 0.4, 5: 0.34, 7: 0.2 },
      8: { 7: 0.4, 5: 0.3, 8: 0.2 },
    }),
  },
]

const MEANINGS = {
  'trophy-big': {
    before: 'Blurry pronoun "it" (could mean anything)',
    after: "An oversized trophy that couldn't fit!",
  },
  'trophy-small': {
    before: 'Blurry pronoun "it" (could mean anything)',
    after: 'A suitcase that is too small!',
  },
  'animal-tired': {
    before: 'Blurry pronoun "it" (could mean anything)',
    after: 'A tired animal that needs a rest!',
  },
  'animal-wide': {
    before: 'Blurry pronoun "it" (could mean anything)',
    after: 'A street that is too wide to cross!',
  },
  'bank-river': {
    before: 'Ambiguous "bank" — water or money?',
    after: 'A grassy riverside where boats float!',
  },
  'bank-money': {
    before: 'Ambiguous "bank" — water or money?',
    after: 'A building where people keep their money!',
  },
}

const ALL_EXAMPLES = [...ATTENTION_EXAMPLES, ...BANK_EXAMPLES].map((ex) => ({
  ...ex,
  ...MEANINGS[ex.id],
}))

const PAIRS = [
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
    id: 'bank',
    emoji: '🏦',
    title: 'Chameleon Word: "bank"',
    prefix: 'Compare:',
    suffix: 'bank',
    options: [
      { word: 'river', exampleId: 'bank-river' },
      { word: 'money', exampleId: 'bank-money' },
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
]

const RECIPE_COLORS = ['#7c3aed', '#0ea5e9', '#10b981']
const ARC_W = 760
const ARC_H = 144

export default function AttentionLab() {
  const [exampleId, setExampleId] = useState(ALL_EXAMPLES[0].id)
  const [queryIndex, setQueryIndex] = useState(ALL_EXAMPLES[0].focusIndex)
  const [attentionOn, setAttentionOn] = useState(true)

  const activeExample = useMemo(
    () => ALL_EXAMPLES.find((e) => e.id === exampleId) || ALL_EXAMPLES[0],
    [exampleId],
  )
  const activePair = useMemo(
    () => PAIRS.find((p) => p.options.some((o) => o.exampleId === exampleId)) || PAIRS[0],
    [exampleId],
  )
  const activeWeights = useMemo(() => {
    const safeIdx = Math.min(queryIndex, activeExample.tokens.length - 1)
    return activeExample.weights[safeIdx] || []
  }, [activeExample, queryIndex])

  const topLinks = useMemo(() => {
    return activeWeights
      .map((weight, idx) => ({ idx, token: activeExample.tokens[idx], weight }))
      .filter((item) => item.idx !== queryIndex)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
  }, [activeWeights, activeExample.tokens, queryIndex])

  const selectPair = (pair) => {
    playClick()
    const ex = ALL_EXAMPLES.find((e) => e.id === pair.options[0].exampleId)
    setExampleId(ex.id)
    setQueryIndex(ex.focusIndex)
  }

  const flipWord = (nextId) => {
    if (nextId === exampleId) return
    playClick()
    const ex = ALL_EXAMPLES.find((e) => e.id === nextId)
    setExampleId(nextId)
    setQueryIndex(ex.focusIndex)
  }

  const tokenCount = activeExample.tokens.length
  const tokenCenterX = (idx) => ((idx + 0.5) / tokenCount) * ARC_W
  const queryWord = activeExample.tokens[queryIndex]
  const isFocusQuery = queryIndex === activeExample.focusIndex

  return (
    <BookChapter
      chapterId={6}
      recapFromPrev="In Chapter 5, every word got a single spot on the Meaning Map. Now let’s see how AI handles words whose meaning changes with context."
      cliffhangerTitle="Awesome — it can READ! Now how does it WRITE?"
      cliffhangerText="With Tokens, Meaning Maps, and Self-Attention, a Transformer can read an entire page and understand every clue in context. In Chapter 7, you'll train your own Mini-LLM and discover the one simple game chatbots play to write brand-new stories!"
    >
      {/* Beat 1: The Self-Attention Spotlight */}
      <BookSection num="1" title="Words Are Chameleons" id="ch6-spotlight">
        <p className="book-prose">
          On its own, a word like <strong>&ldquo;it&rdquo;</strong> or{' '}
          <strong>&ldquo;bank&rdquo;</strong> is blurry — you don’t know what it means until you
          look at the surrounding words!
        </p>
        <p className="book-prose">
          In 2017, researchers invented the <TermTip id="transformer">Transformer</TermTip> using a
          mechanism called <TermTip id="attention">Self-Attention</TermTip>. Every word shines a
          spotlight across the sentence to borrow context from its neighbors.{' '}
          <strong>Flip ONE word below</strong> and watch where the spotlight jumps!
        </p>

        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="attn-pair-tabs" role="tablist" aria-label="Attention puzzles">
            {PAIRS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activePair.id === p.id}
                className={`attention-ex-btn ${activePair.id === p.id ? 'is-active' : ''}`}
                onClick={() => selectPair(p)}
              >
                {p.emoji} {p.title}
              </button>
            ))}
          </div>

          <div className="attn-flip-bar">
            <div className="attn-flip-sentence">
              Flip ONE clue word to change the meaning:
            </div>
            <div className="attn-flip-controls">
              {activePair.options.map((opt) => (
                <button
                  key={opt.exampleId}
                  type="button"
                  className={`attn-flip-btn ${activeExample.id === opt.exampleId ? 'is-active' : ''}`}
                  onClick={() => flipWord(opt.exampleId)}
                >
                  {opt.word}
                </button>
              ))}
            </div>
          </div>

          <div className="attention-stage">
            <div className="attention-stage-hint">
              <span>
                Spotlight from:{' '}
                <strong style={{ color: '#c4b5fd' }}>&ldquo;{queryWord}&rdquo;</strong> — click any word below to move it!
              </span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                Thicker arcs = stronger focus
              </span>
            </div>

            <div className="attention-svg-container">
              <svg viewBox={`0 0 ${ARC_W} ${ARC_H}`} className="attention-svg" role="img" aria-label="Self-attention arcs">
                {activeWeights.map((weight, targetIdx) => {
                  if (targetIdx === queryIndex || weight < 0.05) return null
                  const x1 = tokenCenterX(queryIndex)
                  const x2 = tokenCenterX(targetIdx)
                  const midX = (x1 + x2) / 2
                  const distance = Math.abs(targetIdx - queryIndex)
                  const arcHeight = Math.min(ARC_H - 22, 34 + distance * 13)
                  const ctrlY = ARC_H - arcHeight
                  const isStrong = weight >= 0.22
                  return (
                    <g key={targetIdx}>
                      <path
                        d={`M ${x1} ${ARC_H - 4} Q ${midX} ${ctrlY} ${x2} ${ARC_H - 4}`}
                        fill="none"
                        stroke={isStrong ? '#38bdf8' : '#a78bfa'}
                        strokeWidth={Math.max(1.4, weight * 14)}
                        strokeLinecap="round"
                        opacity={Math.min(1, 0.22 + weight * 1.4)}
                      />
                      {weight >= 0.18 && (
                        <g>
                          <rect x={midX - 20} y={ctrlY + arcHeight * 0.34 - 10} width="40" height="19" rx="9" fill="#1e293b" stroke={isStrong ? '#38bdf8' : '#a78bfa'} />
                          <text x={midX} y={ctrlY + arcHeight * 0.34 + 3} textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)" fill="#f8fafc">
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
                const pct = Math.round((activeWeights[idx] || 0) * 100)
                const isQuery = idx === queryIndex
                const isStrong = !isQuery && (activeWeights[idx] || 0) >= 0.22
                return (
                  <button
                    key={`${tok}-${idx}`}
                    type="button"
                    className={`attention-token-btn ${isQuery ? 'is-query' : ''} ${isStrong ? 'is-strong-target' : ''}`}
                    onClick={() => {
                      playClick()
                      setQueryIndex(idx)
                    }}
                    aria-pressed={isQuery}
                  >
                    <span className="attention-token-word">{tok}</span>
                    <span className="attention-token-weight">{pct}%</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="callout-kid" style={{ fontSize: '0.92rem' }}>
            <strong>{isFocusQuery ? 'What just happened?' : `Spotlight on "${queryWord}":`}</strong>{' '}
            {isFocusQuery
              ? activeExample.explanation
              : `"${queryWord}" focuses most strongly on "${topLinks[0]?.token || ''}" (${Math.round((topLinks[0]?.weight || 0) * 100)}%). Click "${activeExample.tokens[activeExample.focusIndex]}" to see the main puzzle!`}
          </div>
        </div>
      </BookSection>

      {/* Beat 2: Before & After Attention */}
      <BookSection num="2" title="Blending a Context-Aware Meaning" id="ch6-blend">
        <p className="book-prose">
          Once the spotlight scores every neighbor, the word blends a recipe of their meanings into
          its own vector. Try toggling Attention <strong>OFF</strong> and <strong>ON</strong> to see
          the difference:
        </p>

        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <strong style={{ fontSize: '0.96rem' }}>
              Meaning Transformation for &ldquo;{queryWord}&rdquo;
            </strong>
            <button
              type="button"
              className={`btn btn-sm ${attentionOn ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                playClick()
                setAttentionOn((v) => !v)
              }}
            >
              <Eye size={14} />
              <span>{attentionOn ? 'Compare: Turn Attention OFF' : 'Turn Attention Back ON'}</span>
            </button>
          </div>

          <div className="attn-ba-grid">
            <div className="attn-ba-box is-before">
              <span className="attn-ba-label">Before Attention</span>
              <strong className="attn-ba-word">{queryWord}</strong>
              <span className="attn-ba-text">
                {isFocusQuery ? activeExample.before : `Plain word "${queryWord}" alone`}
              </span>
            </div>

            <div className="attn-ba-arrow" aria-hidden="true">→</div>

            <div className="attn-ba-box is-recipe">
              <span className="attn-ba-label">Attention Blend</span>
              <div className="attn-recipe-bar">
                {attentionOn ? (
                  topLinks.map((link, i) => (
                    <span
                      key={link.idx}
                      className="attn-recipe-seg"
                      style={{ flexGrow: Math.max(1, link.weight * 100), background: RECIPE_COLORS[i] }}
                    >
                      {Math.round(link.weight * 100)}% {link.token}
                    </span>
                  ))
                ) : (
                  <span className="attn-recipe-seg is-off" style={{ flexGrow: 1 }}>
                    attention off
                  </span>
                )}
              </div>
            </div>

            <div className="attn-ba-arrow" aria-hidden="true">→</div>

            <div className={`attn-ba-box is-after ${attentionOn ? 'is-on' : ''}`}>
              <span className="attn-ba-label">After Attention</span>
              <strong className="attn-ba-word">{queryWord}{attentionOn ? '′' : ''}</strong>
              <span className="attn-ba-text">
                {attentionOn
                  ? isFocusQuery
                    ? activeExample.after
                    : `"${queryWord}" flavored with "${topLinks[0]?.token || ''}"`
                  : isFocusQuery
                    ? activeExample.before
                    : `Plain word "${queryWord}" alone`}
              </span>
            </div>
          </div>

          <div className="book-takeaway" style={{ fontSize: '0.88rem' }}>
            <strong>Team of Spotlights:</strong> Real Transformers run dozens of attention{' '}
            <em>heads</em> at once — one tracking pronouns (who?), one tracking adjectives (size?),
            and one tracking actions!
          </div>

          <MathDrawer title="Peek at the Math: Queries, Keys & Values (Q, K, V)">
            <p>
              Every token projects into a <strong>Query (Q)</strong> (&ldquo;what clue do I need?&rdquo;),
              a <strong>Key (K)</strong> (&ldquo;what clue do I offer?&rdquo;), and a{' '}
              <strong>Value (V)</strong> (&ldquo;my meaning to share&rdquo;):
            </p>
            <div className="formula-box">
              Attention(Q, K, V) = softmax((Q · Kᵀ) / √d_k) · V
            </div>
          </MathDrawer>
        </div>
      </BookSection>
    </BookChapter>
  )
}
