import { useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { ArrowRight, CheckCircle2, RotateCcw, Sparkles, StepForward } from 'lucide-react'
import TermTip from '../components/TermTip.jsx'
import { playClick, playStep, playSuccess } from '../utils/sound.js'

const ARCHITECTURES = [
  {
    id: 'mlp',
    glossaryId: 'mlp',
    name: 'Feedforward / MLP',
    shortName: 'Feedforward MLP',
    badge: 'One-Way Flow',
    color: '#6366f1',
    emoji: '🕸️',
    tagline: 'Stacked layers with no loops',
    howItWorks:
      'Signals travel strictly left-to-right: inputs enter, pass through 1 or more hidden layers that combine clues, and produce a final guess.',
    superpower: 'Finds curved patterns in spreadsheets, coordinates, and game stats.',
    jobs: 'House price estimates, loan risk checks, simple game AI, Stage 2 decision maps.',
    deepNote: 'Dense affine transforms + non-linear activations: h⁽ˡ⁾ = σ(W⁽ˡ⁾h⁽ˡ⁻¹⁾ + b⁽ˡ⁾).',
    stageLink: { id: 2, label: 'Try it in Stage 2 →' },
  },
  {
    id: 'cnn',
    glossaryId: 'cnn',
    name: 'Convolutional / CNN',
    shortName: 'CNN (Vision)',
    badge: 'Sliding Lenses',
    color: '#10b981',
    emoji: '🔍',
    tagline: 'Shared local filters scan grids',
    howItWorks:
      'Instead of wiring every pixel to every neuron, a CNN slides tiny 3×3 filter lenses across an image to spot edges first, then shapes, then whole objects.',
    superpower: 'Recognizes an object no matter where it sits in a photo!',
    jobs: 'Self-driving car cameras, handwriting readers, medical X-rays, face filters.',
    deepNote: 'Weight-sharing spatial convolutions + pooling layers build translation-invariant feature maps.',
    stageLink: { id: 4, label: 'Try it in Stage 4 →' },
  },
  {
    id: 'rnn',
    glossaryId: 'rnn',
    name: 'Recurrent / RNN',
    shortName: 'RNN (Memory Loop)',
    badge: 'Memory Loop ↺',
    color: '#f59e0b',
    emoji: '🔁',
    tagline: 'Hidden state loops back in time',
    howItWorks:
      'Reads one item at a time and sends its hidden memory state back into itself on the next step — like keeping a running notepad as you read!',
    superpower: 'Tracks order and trends across time-ordered streams.',
    jobs: 'Live weather/temperature sensors, speech audio streams, heartbeat monitors.',
    deepNote: 'Recurrent state update hₜ = tanh(W·xₜ + U·hₜ₋₁ + b); LSTMs add gates to prevent vanishing gradients.',
    stageLink: null,
  },
  {
    id: 'transformer',
    glossaryId: 'transformer',
    name: 'Transformer',
    shortName: 'Transformer',
    badge: 'Attention Bridges',
    color: '#8b5cf6',
    emoji: '✨',
    tagline: 'Every word looks at every other word',
    howItWorks:
      'Reads all words in parallel and draws glowing attention bridges between related words (like linking "it" back to "trophy") across dozens of stacked layers.',
    superpower: 'Understands long stories, code, and nuance without forgetting the beginning.',
    jobs: 'ChatGPT & Gemini (LLMs), code assistants, instant translation, multimodal AI.',
    deepNote: 'Multi-head scaled dot-product self-attention Attention(Q,K,V) = softmax(QKᵀ/√dₖ)V + residual MLP blocks.',
    stageLink: { id: 5, label: 'Try it in Stage 5 →' },
  },
]

const RNN_DEMO_WORDS = [
  { word: 'The', memory: 'Starting a sentence… waiting for who!' },
  { word: 'dog', memory: 'Subject = 🐶 dog' },
  { word: 'chased', memory: '🐶 dog is doing action: chasing!' },
  { word: 'the', memory: '🐶 dog chased → expecting a target…' },
  { word: 'ball', memory: 'Full scene: 🐶 dog chased ⚽ ball!' },
]

const DEPTH_LEVELS = [
  {
    id: 1,
    label: '1 Layer (Shallow)',
    subtitle: 'Just 1 straight fence',
    chain: ['Raw Inputs', 'Single Decision'],
    canDo: 'Simple yes/no rules (AND, OR, "is it sunny + warm?").',
    cantDo: 'Cannot bend around XOR checkerboards, circles, or photos.',
    deepNote: 'Linearly separable half-spaces only (Minsky & Papert, 1969).',
  },
  {
    id: 2,
    label: '2–3 Layers (Multi-Layer)',
    subtitle: 'Combines simple lines into shapes',
    chain: ['Inputs', 'Hidden Layer 1 (Lines)', 'Hidden Layer 2 (Regions)', 'Output'],
    canDo: 'Solves XOR, rings, spirals, and hand-drawn digits!',
    cantDo: 'Struggles with rich real-world photos or multi-page essays.',
    deepNote: 'Universal Function Approximator: 1+ non-linear hidden layers can approximate any continuous boundary.',
  },
  {
    id: 3,
    label: 'Deep (10–100+ Layers)',
    subtitle: 'Builds concepts on top of concepts',
    chain: ['Pixels / Words', 'Edges / Grammar', 'Parts (Eyes, Tone)', 'Whole Concepts (Cat, Plot)', 'Smart Output'],
    canDo: 'Real-time camera detection, writing code, reasoning across books.',
    cantDo: 'Needs lots of data, GPUs, and careful skip-connections to train.',
    deepNote: 'Hierarchical representation learning: deeper layers capture increasingly abstract semantic features.',
  },
]

const NODE_TYPES = [
  {
    id: 'input',
    emoji: '👀',
    name: 'Input Nodes',
    role: 'The Senses',
    summary: 'Receive raw numbers from the outside world — pixel brightness, word IDs, or sensor readings.',
    exampleIn: 'Top-left image zone brightness',
    exampleOut: '0.82 (bright ink detected)',
  },
  {
    id: 'hidden',
    emoji: '🧩',
    name: 'Hidden / Feature Nodes',
    role: 'Pattern Spotters',
    summary: 'Combine inputs to detect reusable clues like "Top Bar", "Diagonal /", or "Happy Tone".',
    exampleIn: '4 bright top-row pixels',
    exampleOut: 'Top Bar = 89% active',
  },
  {
    id: 'memory',
    emoji: '🧠',
    name: 'Memory / Recurrent Nodes',
    role: 'Time Keepers',
    summary: 'Feed their own output back into themselves so they carry context from earlier steps.',
    exampleIn: 'Prev memory ("dog") + new word ("chased")',
    exampleOut: 'Updated memory ("dog is chasing")',
  },
  {
    id: 'attention',
    emoji: '🔦',
    name: 'Attention / Router Nodes',
    role: 'Context Spotlights',
    summary: 'Compare every word against every other word and dynamically route focus to the most helpful clues.',
    exampleIn: 'Query "it" in "trophy… suitcase… too big"',
    exampleOut: '78% focus on "trophy", 14% on "suitcase"',
  },
  {
    id: 'output',
    emoji: '🎯',
    name: 'Output Nodes',
    role: 'Final Decision',
    summary: 'Turn internal clues into final probabilities (often via Softmax) so all choices add up to 100%.',
    exampleIn: 'Raw class scores for digits 0–9',
    exampleOut: '"7" = 86%, "9" = 7%, "2" = 4%…',
  },
]

const BRAIN_QUIZ = [
  {
    id: 'q1',
    emoji: '🛑',
    prompt: 'Spot stop signs and pedestrians inside live self-driving car camera frames.',
    answer: 'cnn',
    why: 'CNNs slide local pattern filters across 2D image grids, making them unbeatable for spotting visual shapes anywhere in a frame.',
  },
  {
    id: 'q2',
    emoji: '🌡️',
    prompt: 'Predict the next reading in a rolling live temperature stream using a step-by-step memory loop.',
    answer: 'rnn',
    why: 'RNNs carry a hidden memory state forward from step to step via a feedback loop — ideal for compact sequential sensor streams.',
  },
  {
    id: 'q3',
    emoji: '📖',
    prompt: 'Write a 5-page adventure story while remembering every character introduced on page 1.',
    answer: 'transformer',
    why: 'Transformers use parallel self-attention bridges so words on page 5 can directly attend back to characters on page 1!',
  },
  {
    id: 'q4',
    emoji: '🏡',
    prompt: 'Estimate a house price from a neat table of numbers: bedrooms, square feet, and neighborhood score.',
    answer: 'mlp',
    why: 'A Feedforward MLP combines fixed tabular features through hidden layers without needing image grids or sequence loops.',
  },
]

function ArchitectureSvg({ archId, rnnStep }) {
  if (archId === 'mlp') {
    const layers = [
      { x: 64, ys: [52, 110, 168], color: '#0284c7', fill: '#e0f2fe', label: 'Inputs' },
      { x: 185, ys: [40, 86, 134, 180], color: '#6366f1', fill: '#eef2ff', label: 'Hidden 1' },
      { x: 315, ys: [58, 110, 162], color: '#6366f1', fill: '#eef2ff', label: 'Hidden 2' },
      { x: 436, ys: [110], color: '#10b981', fill: '#d1fae5', label: 'Output' },
    ]
    return (
      <svg viewBox="0 0 500 220" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Feedforward MLP diagram">
        {layers.slice(0, -1).map((layer, lIdx) =>
          layer.ys.map((y1, i) =>
            layers[lIdx + 1].ys.map((y2, j) => (
              <line
                key={`${lIdx}-${i}-${j}`}
                x1={layer.x + 16}
                y1={y1}
                x2={layers[lIdx + 1].x - 16}
                y2={y2}
                stroke="#6366f1"
                strokeOpacity="0.35"
                strokeWidth="2"
                className="tm-pulse-forward"
              />
            )),
          ),
        )}
        {layers.map((layer) => (
          <g key={layer.label}>
            {layer.ys.map((y, idx) => (
              <circle
                key={idx}
                cx={layer.x}
                cy={y}
                r="16"
                fill={layer.fill}
                stroke={layer.color}
                strokeWidth="2.5"
              />
            ))}
            <text x={layer.x} y="208" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">
              {layer.label}
            </text>
          </g>
        ))}
      </svg>
    )
  }

  if (archId === 'cnn') {
    return (
      <svg viewBox="0 0 500 220" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Convolutional Neural Network diagram">
        {/* 4x4 Image Grid */}
        <g transform="translate(24, 46)">
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={c * 24}
                y={r * 24}
                width="22"
                height="22"
                rx="4"
                fill={(r === 1 && c >= 1) || c === 2 ? '#10b981' : '#e2e8f0'}
                fillOpacity={(r === 1 && c >= 1) || c === 2 ? 0.85 : 0.7}
              />
            )),
          )}
          <rect x="23" y="23" width="48" height="48" rx="6" fill="none" stroke="#f59e0b" strokeWidth="3" />
          <text x="48" y="120" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">
            Image Grid
          </text>
        </g>

        <line x1="126" y1="94" x2="176" y2="94" stroke="#10b981" strokeWidth="3" className="tm-pulse-forward" />

        {/* Stacked Filter Feature Maps */}
        <g transform="translate(182, 52)">
          <rect x="0" y="0" width="66" height="66" rx="10" fill="#d1fae5" stroke="#10b981" strokeWidth="2" />
          <rect x="12" y="12" width="66" height="66" rx="10" fill="#a7f3d0" stroke="#059669" strokeWidth="2" />
          <text x="45" y="50" textAnchor="middle" fontSize="11" fontWeight="800" fill="#065f46">
            3×3 Lens
          </text>
          <text x="40" y="114" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">
            Conv Filters
          </text>
        </g>

        <line x1="266" y1="94" x2="314" y2="94" stroke="#10b981" strokeWidth="3" className="tm-pulse-forward" />

        {/* Pooling */}
        <g transform="translate(320, 68)">
          <rect x="0" y="0" width="54" height="54" rx="10" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2.5" />
          <text x="27" y="31" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0369a1">
            Pool
          </text>
          <text x="27" y="98" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">
            Shrink
          </text>
        </g>

        <line x1="380" y1="94" x2="418" y2="94" stroke="#10b981" strokeWidth="3" className="tm-pulse-forward" />

        {/* Object Output */}
        <g transform="translate(454, 94)">
          <circle r="30" fill="#10b981" stroke="#047857" strokeWidth="3" />
          <text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffffff">
            Cat!
          </text>
          <text x="0" y="72" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">
            Object
          </text>
        </g>
      </svg>
    )
  }

  if (archId === 'rnn') {
    const activeWord = RNN_DEMO_WORDS[rnnStep]
    return (
      <svg viewBox="0 0 500 220" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Recurrent Neural Network memory feedback loop diagram">
        {/* Feedback loop arc above hidden memory node */}
        <path
          d="M 276 82 C 330 10, 170 10, 224 82"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="4.5"
          strokeLinecap="round"
          className="tm-pulse-forward"
        />
        <polygon points="224,86 214,72 232,74" fill="#d97706" />
        <rect x="176" y="14" width="148" height="24" rx="12" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="250" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill="#92400e">
          ↺ Memory Feedback Loop
        </text>

        {/* Input -> Hidden -> Output */}
        <line x1="116" y1="128" x2="200" y2="128" stroke="#0284c7" strokeWidth="3.5" className="tm-pulse-forward" />
        <line x1="300" y1="128" x2="382" y2="128" stroke="#10b981" strokeWidth="3.5" className="tm-pulse-forward" />

        <g transform="translate(76, 128)">
          <rect x="-42" y="-26" width="84" height="52" rx="14" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2.5" />
          <text x="0" y="-4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0369a1">
            Word #{rnnStep + 1}
          </text>
          <text x="0" y="15" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill="#0f172a">
            &ldquo;{activeWord.word}&rdquo;
          </text>
        </g>

        <g transform="translate(250, 128)">
          <circle r="48" fill="#fffbeb" stroke="#f59e0b" strokeWidth="3.5" />
          <text x="0" y="-6" textAnchor="middle" fontSize="11" fontWeight="800" fill="#92400e">
            Memory State
          </text>
          <text x="0" y="13" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="monospace" fill="#0f172a">
            hₜ (step {rnnStep + 1})
          </text>
        </g>

        <g transform="translate(422, 128)">
          <circle r="36" fill="#d1fae5" stroke="#10b981" strokeWidth="2.5" />
          <text x="0" y="-4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#065f46">
            Guess
          </text>
          <text x="0" y="14" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f172a">
            Next
          </text>
        </g>
      </svg>
    )
  }

  // Transformer
  const words = ['The', 'trophy', 'did', 'not', 'fit', 'it']
  const xs = [54, 132, 210, 288, 366, 446]
  return (
    <svg viewBox="0 0 500 220" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Transformer self-attention bridges diagram">
      {/* Glowing attention arcs from "it" to earlier words */}
      <path d="M 446 130 Q 288 18 132 130" fill="none" stroke="#8b5cf6" strokeWidth="5" className="tm-pulse-forward" />
      <path d="M 446 130 Q 406 68 366 130" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeOpacity="0.65" />
      <path d="M 446 130 Q 328 52 210 130" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeOpacity="0.5" />
      <rect x="192" y="22" width="194" height="24" rx="12" fill="#f3e8ff" stroke="#8b5cf6" strokeWidth="1.5" />
      <text x="289" y="38" textAnchor="middle" fontSize="11" fontWeight="800" fill="#5b21b6">
        ✨ Parallel Self-Attention Bridges
      </text>

      {words.map((w, idx) => {
        const highlight = w === 'trophy' || w === 'it'
        return (
          <g key={w} transform={`translate(${xs[idx]}, 152)`}>
            <rect
              x="-30"
              y="-22"
              width="60"
              height="44"
              rx="12"
              fill={highlight ? '#ede9fe' : '#f8fafc'}
              stroke={highlight ? '#8b5cf6' : '#cbd5e1'}
              strokeWidth={highlight ? 2.5 : 1.5}
            />
            <text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="800" fill={highlight ? '#4c1d95' : '#334155'}>
              {w}
            </text>
          </g>
        )
      })}
      <text x="250" y="206" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">
        All words processed at once across stacked Attention + MLP layers
      </text>
    </svg>
  )
}

export default function NetworkZooPanel({ isDeepDive, navigate }) {
  const [archId, setArchId] = useState('mlp')
  const [rnnStep, setRnnStep] = useState(0)
  const [anatomyTab, setAnatomyTab] = useState('layers')
  const [depthId, setDepthId] = useState(2)
  const [nodeId, setNodeId] = useState('hidden')
  const [answers, setAnswers] = useState({})
  const celebratedQuizRef = useRef(false)

  const arch = ARCHITECTURES.find((a) => a.id === archId) || ARCHITECTURES[0]
  const depth = DEPTH_LEVELS.find((d) => d.id === depthId) || DEPTH_LEVELS[1]
  const activeNode = NODE_TYPES.find((n) => n.id === nodeId) || NODE_TYPES[1]

  const correctCount = BRAIN_QUIZ.filter((q) => answers[q.id] === q.answer).length

  const handlePickQuiz = (qId, choice) => {
    const q = BRAIN_QUIZ.find((item) => item.id === qId)
    const nextAnswers = { ...answers, [qId]: choice }
    setAnswers(nextAnswers)

    if (q && choice === q.answer) {
      playSuccess()
      const nextScore = BRAIN_QUIZ.filter((item) => nextAnswers[item.id] === item.answer).length
      if (nextScore === BRAIN_QUIZ.length && !celebratedQuizRef.current) {
        celebratedQuizRef.current = true
        confetti({ particleCount: 70, spread: 68, origin: { y: 0.7 } })
      }
    } else {
      playClick()
    }
  }

  return (
    <div className="zoo-stack">
      {/* Section 1: 4 Types of Neural Networks */}
      <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem' }}>🦁 1. Four Types of Neural Networks</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 3 }}>
            Not all AI brains are wired the same! Click each blueprint to see how its layers and signals work.
          </p>
        </div>

        <div className="zoo-arch-tabs" role="tablist" aria-label="Neural network architecture types">
          {ARCHITECTURES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={archId === item.id}
              className={`zoo-arch-btn ${archId === item.id ? 'is-active' : ''}`}
              style={{ '--arch-color': item.color }}
              onClick={() => {
                setArchId(item.id)
                playClick()
              }}
            >
              <span className="zoo-arch-badge">{item.badge}</span>
              <span className="zoo-arch-name">
                {item.emoji} {item.shortName}
              </span>
              <span className="zoo-arch-sub">{item.tagline}</span>
            </button>
          ))}
        </div>

        <div className="zoo-blueprint-grid">
          <div className="zoo-svg-stage">
            <ArchitectureSvg archId={arch.id} rnnStep={rnnStep} />

            {arch.id === 'rnn' && (
              <div className="zoo-rnn-demo">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <strong style={{ fontSize: '0.88rem', color: '#92400e' }}>
                    ↺ Interactive Memory Loop Demo
                  </strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ background: '#f59e0b', boxShadow: 'none' }}
                      onClick={() => {
                        playStep()
                        setRnnStep((s) => (s + 1) % RNN_DEMO_WORDS.length)
                      }}
                    >
                      <StepForward size={14} />
                      <span>Step Next Word</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        playClick()
                        setRnnStep(0)
                      }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                <div className="zoo-word-strip">
                  {RNN_DEMO_WORDS.map((item, idx) => (
                    <span
                      key={item.word}
                      className={`zoo-word-chip ${
                        idx === rnnStep ? 'is-current' : idx < rnnStep ? 'is-seen' : ''
                      }`}
                    >
                      {item.word}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: '0.85rem', color: '#78350f', fontWeight: 600 }}>
                  💭 Live Memory Bubble: <strong>{RNN_DEMO_WORDS[rnnStep].memory}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="zoo-info-list">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.15rem' }}>
                {arch.emoji} <TermTip id={arch.glossaryId}>{arch.name}</TermTip>
              </h3>
              {arch.stageLink && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    playClick()
                    navigate(`/stage/${arch.stageLink.id}`)
                  }}
                >
                  <span>{arch.stageLink.label}</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>

            <div className="zoo-info-box">
              <strong>How it works:</strong> {arch.howItWorks}
            </div>
            <div className="zoo-info-box">
              <strong>⚡ Superpower:</strong> {arch.superpower}
            </div>
            <div className="zoo-info-box">
              <strong>🌍 Real-world jobs:</strong> {arch.jobs}
            </div>
            {isDeepDive && <div className="formula-box">{arch.deepNote}</div>}
          </div>
        </div>
      </section>

      {/* Section 2: Anatomy Explorer */}
      <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.22rem' }}>🧬 2. Brain Anatomy Explorer</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Explore why networks stack layers, what different specialist nodes do, and how feedback loops work.
            </p>
          </div>

          <div className="zoo-subtabs" role="tablist" aria-label="Anatomy explorer topics">
            {[
              { id: 'layers', label: 'Multiple Layers' },
              { id: 'nodes', label: 'Node Types (5)' },
              { id: 'loops', label: 'Feedback Loops' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={anatomyTab === t.id}
                className={`zoo-subtab-btn ${anatomyTab === t.id ? 'is-active' : ''}`}
                onClick={() => {
                  setAnatomyTab(t.id)
                  playClick()
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {anatomyTab === 'layers' && (
          <div>
            <div className="zoo-depth-steps" role="group" aria-label="Network depth selector">
              {DEPTH_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  className={`zoo-depth-pill ${depthId === lvl.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setDepthId(lvl.id)
                    playClick()
                  }}
                >
                  <div>{lvl.label}</div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 500, opacity: 0.8 }}>{lvl.subtitle}</div>
                </button>
              ))}
            </div>

            <div className="zoo-layer-chain" aria-label="Layer concept progression">
              {depth.chain.map((step, idx) => (
                <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="zoo-layer-block">{step}</span>
                  {idx < depth.chain.length - 1 && (
                    <ArrowRight size={16} color="#6366f1" aria-hidden="true" />
                  )}
                </span>
              ))}
            </div>

            <div className="zoo-loops-grid" style={{ marginTop: 12 }}>
              <div className="zoo-info-box" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <strong>✅ What it CAN do:</strong> {depth.canDo}
              </div>
              <div className="zoo-info-box" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                <strong>🚧 What stumps it:</strong> {depth.cantDo}
              </div>
            </div>

            {isDeepDive && (
              <div className="formula-box" style={{ marginTop: 10 }}>
                {depth.deepNote}
              </div>
            )}
          </div>
        )}

        {anatomyTab === 'nodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="zoo-nodes-grid">
              {NODE_TYPES.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={`zoo-node-card ${nodeId === node.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setNodeId(node.id)
                    playClick()
                  }}
                >
                  <span style={{ fontSize: '1.35rem' }} aria-hidden="true">
                    {node.emoji}
                  </span>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{node.name}</strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{node.role}</span>
                </button>
              ))}
            </div>

            <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                {activeNode.emoji} {activeNode.name} — {activeNode.role}
              </div>
              <p style={{ marginBottom: 8 }}>{activeNode.summary}</p>
              <div className="font-mono" style={{ fontSize: '0.82rem' }}>
                <strong>In:</strong> {activeNode.exampleIn} &nbsp;→&nbsp; <strong>Out:</strong> {activeNode.exampleOut}
              </div>
            </div>
          </div>
        )}

        {anatomyTab === 'loops' && (
          <div className="zoo-loops-grid">
            <div className="zoo-loop-card" style={{ borderColor: '#fca5a5' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#b91c1c' }}>
                1. Learning <TermTip id="feedback-loop">Feedback Loop</TermTip> (<TermTip id="backprop">Backprop</TermTip>)
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Happens <strong>during training</strong>. Mistakes travel <em>backward</em> from the output to nudge weights so the next guess is smarter.
              </p>
              <div className="zoo-loop-flow" style={{ background: '#fef2f2', color: '#991b1b' }}>
                <span>Guess</span> → <span>Measure Error</span> → <span>Backward Blame</span> → <span>↺ Better Weights</span>
              </div>
            </div>

            <div className="zoo-loop-card" style={{ borderColor: '#fcd34d' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#92400e' }}>
                2. Memory &amp; Sequence Loop (<TermTip id="rnn">RNN</TermTip> &amp; <TermTip id="autoregressive">LLMs</TermTip>)
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Happens <strong>while thinking/generating</strong>. Hidden memory or a newly generated word loops <em>forward</em> into the very next step!
              </p>
              <div className="zoo-loop-flow" style={{ background: '#fffbeb', color: '#92400e' }}>
                <span>Word 1</span> → <span>↺ Hidden Memory / New Token</span> → <span>Informs Word 2</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Interactive Mini-Challenge */}
      <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: '1.22rem' }}>🎮 3. Pick the Right Brain for the Job!</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Match each real-world mission to the neural network architecture built for it.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${correctCount === BRAIN_QUIZ.length ? 'badge-success' : 'badge-subtle'}`}>
              <Sparkles size={13} />
              Score: {correctCount}/{BRAIN_QUIZ.length}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                playClick()
                setAnswers({})
                celebratedQuizRef.current = false
              }}
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="zoo-quiz-grid">
          {BRAIN_QUIZ.map((q) => {
            const picked = answers[q.id]
            const isCorrect = picked === q.answer
            const isWrong = Boolean(picked) && !isCorrect

            return (
              <div
                key={q.id}
                className={`zoo-quiz-card ${isCorrect ? 'is-correct' : isWrong ? 'is-wrong' : ''}`}
              >
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  <span aria-hidden="true" style={{ marginRight: 6 }}>
                    {q.emoji}
                  </span>
                  {q.prompt}
                </div>

                <div className="zoo-quiz-options">
                  {ARCHITECTURES.map((opt) => {
                    const isThisPicked = picked === opt.id
                    let btnCls = 'zoo-quiz-opt'
                    if (isThisPicked && isCorrect) btnCls += ' is-picked-right'
                    else if (isThisPicked && isWrong) btnCls += ' is-picked-wrong'

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={btnCls}
                        onClick={() => handlePickQuiz(q.id, opt.id)}
                      >
                        {opt.emoji} {opt.shortName}
                      </button>
                    )
                  })}
                </div>

                {picked && (
                  <div style={{ fontSize: '0.82rem', color: isCorrect ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                    {isCorrect ? (
                      <>
                        <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Spot on! {q.why}
                      </>
                    ) : (
                      <>Not quite — think about what kind of pattern or memory this job needs, and try another brain!</>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
