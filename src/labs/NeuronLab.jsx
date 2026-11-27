import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { CheckCircle2, Lightbulb, RotateCcw } from 'lucide-react'
import {
  PERCEPTRON_CHALLENGES,
  PERCEPTRON_SCENARIOS,
  checkPerceptronChallenge,
  computePerceptron,
} from '../engine/perceptron.js'
import { playClick, playNeuronFire, playSuccess } from '../utils/sound.js'
import BookChapter, { BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './NeuronLab.css'

function formatSigned(val, decimals = 1) {
  const fixed = Number(val).toFixed(decimals)
  return Number(val) > 0 ? `+${fixed}` : fixed
}

function NeuronDiagram({ inputs, labels, weights, bias, result, onToggleInput }) {
  const count = inputs.length
  const svgW = 540
  const svgH = Math.max(240, count * 64 + 44)
  const inputX = 94
  const somaX = 310
  const somaY = svgH / 2
  const outX = 468

  const getInputY = (idx) => {
    if (count === 1) return somaY
    const top = 44
    const bottom = svgH - 52
    return top + (idx / (count - 1)) * (bottom - top)
  }

  return (
    <div className="neuron-svg-wrap">
      <svg
        className="neuron-svg"
        viewBox={`0 0 ${svgW} ${svgH}`}
        role="img"
        aria-label="Interactive artificial neuron diagram"
      >
        <defs>
          <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {inputs.map((val, idx) => {
          const y = getInputY(idx)
          const w = weights[idx] ?? 0
          const isPos = w > 0.05
          const isNeg = w < -0.05
          const stroke = isPos ? '#0d9488' : isNeg ? '#ef4444' : '#94a3b8'
          const width = Math.max(1.8, Math.min(7.5, 1.5 + Math.abs(w) * 1.15))
          const midX = (inputX + somaX) / 2
          const midY = (y + somaY) / 2
          const active = val > 0 && Math.abs(w) > 0.05

          return (
            <g key={`edge-${idx}`}>
              <line
                x1={inputX + 34}
                y1={y}
                x2={somaX - 42}
                y2={somaY}
                stroke={stroke}
                strokeWidth={width}
                strokeOpacity={val > 0 ? 0.92 : 0.32}
                strokeLinecap="round"
                className={active ? 'neuron-edge-active' : undefined}
              />
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x="-30"
                  y="-11"
                  width="60"
                  height="22"
                  rx="11"
                  fill="#ffffff"
                  stroke={stroke}
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                  fill={stroke}
                >
                  w{idx + 1}:{formatSigned(w)}
                </text>
              </g>
            </g>
          )
        })}

        <line
          x1={somaX + 44}
          y1={somaY}
          x2={outX - 38}
          y2={somaY}
          stroke={result.fired ? '#f59e0b' : '#cbd5e1'}
          strokeWidth={result.fired ? 5 : 3}
          strokeLinecap="round"
          className={result.fired ? 'neuron-edge-active' : undefined}
        />

        <line
          x1={somaX}
          y1={svgH - 22}
          x2={somaX}
          y2={somaY + 44}
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeDasharray="4 3"
        />
        <g transform={`translate(${somaX}, ${svgH - 18})`}>
          <rect x="-46" y="-13" width="92" height="26" rx="13" fill="#eef2ff" stroke="#818cf8" strokeWidth="1.5" />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
            fill="#3730a3"
          >
            bias: {formatSigned(bias)}
          </text>
        </g>

        {inputs.map((val, idx) => {
          const y = getInputY(idx)
          const isOn = val > 0
          return (
            <g
              key={`in-${idx}`}
              className={onToggleInput ? 'neuron-node-clickable' : undefined}
              onClick={onToggleInput ? () => onToggleInput(idx) : undefined}
              role={onToggleInput ? 'button' : undefined}
              tabIndex={onToggleInput ? 0 : undefined}
              onKeyDown={
                onToggleInput
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onToggleInput(idx)
                      }
                    }
                  : undefined
              }
              aria-label={`Input ${labels[idx]} is ${isOn ? 'ON' : 'OFF'}`}
            >
              <rect
                x="10"
                y={y - 22}
                width="118"
                height="44"
                rx="14"
                fill={isOn ? '#ecfdf5' : '#f8fafc'}
                stroke={isOn ? '#10b981' : '#cbd5e1'}
                strokeWidth="2"
              />
              <text x="22" y={y - 3} fontSize="11" fontWeight="700" fill="#0f172a">
                {labels[idx].length > 14 ? `${labels[idx].slice(0, 13)}…` : labels[idx]}
              </text>
              <text
                x="22"
                y={y + 13}
                fontSize="11"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                fill={isOn ? '#059669' : '#64748b'}
              >
                {isOn ? 'ON (1)' : 'OFF (0)'} {onToggleInput ? '· tap' : ''}
              </text>
            </g>
          )
        })}

        <g transform={`translate(${somaX}, ${somaY})`}>
          <circle
            r="44"
            fill={result.fired ? '#fffbeb' : '#ffffff'}
            stroke={result.fired ? '#f59e0b' : '#94a3b8'}
            strokeWidth="3.5"
          />
          <text x="0" y="-10" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">
            Total Score
          </text>
          <text
            x="0"
            y="10"
            textAnchor="middle"
            fontSize="16"
            fontWeight="800"
            fontFamily="var(--font-mono)"
            fill="#0f172a"
          >
            {formatSigned(result.weightedSum, 2)}
          </text>
          <text x="0" y="26" textAnchor="middle" fontSize="10" fontWeight="600" fill="#6366f1">
            fires at ≥ 0
          </text>
        </g>

        <g transform={`translate(${outX}, ${somaY})`}>
          {result.fired && (
            <>
              <circle r="52" fill="url(#bulbGlow)" />
              <circle r="40" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="neuron-spark-ring" />
            </>
          )}
          <circle
            r="36"
            fill={result.fired ? '#f59e0b' : '#e2e8f0'}
            stroke={result.fired ? '#d97706' : '#94a3b8'}
            strokeWidth="3"
          />
          <text
            x="0"
            y="-3"
            textAnchor="middle"
            fontSize="15"
            fontWeight="800"
            fill={result.fired ? '#ffffff' : '#475569'}
          >
            {result.fired ? 'YES!' : 'NO'}
          </text>
          <text
            x="0"
            y="15"
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
            fill={result.fired ? '#fef3c7' : '#64748b'}
          >
            out = {result.output}
          </text>
        </g>
      </svg>
    </div>
  )
}

const BOOK_PUZZLES = PERCEPTRON_CHALLENGES.filter((c) => c.id === 'and' || c.id === 'or')

export default function NeuronLab() {
  // Demo 1A: Single relatable scenario ("Go to the Park?")
  const scenario = PERCEPTRON_SCENARIOS[0]
  const [inputs, setInputs] = useState(() => scenario.inputs.map((i) => i.defaultValue))
  const [weights, setWeights] = useState(() => scenario.inputs.map((i) => i.defaultWeight))
  const [bias, setBias] = useState(() => scenario.bias)

  // Demo 1B: Wire a Logic Lock (AND / OR)
  const [challengeId, setChallengeId] = useState('and')
  const challenge = useMemo(
    () => BOOK_PUZZLES.find((c) => c.id === challengeId) || BOOK_PUZZLES[0],
    [challengeId],
  )
  const [cWeights, setCWeights] = useState([0.5, 0.5])
  const [cBias, setCBias] = useState(0)
  const [previewRowIdx, setPreviewRowIdx] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [solvedIds, setSolvedIds] = useState(() => new Set())
  const celebratedRef = useRef(new Set())

  const sandboxResult = useMemo(
    () => computePerceptron(inputs, weights, bias, 'step'),
    [inputs, weights, bias],
  )

  const challengeEval = useMemo(
    () => checkPerceptronChallenge(challenge, cWeights, cBias, 'step'),
    [challenge, cWeights, cBias],
  )

  const previewRow = challenge.truthTable[previewRowIdx] || challenge.truthTable[0]
  const challengeResult = useMemo(
    () => computePerceptron(previewRow.inputs, cWeights, cBias, 'step'),
    [previewRow, cWeights, cBias],
  )

  const prevFiredRef = useRef(sandboxResult.fired)
  useEffect(() => {
    if (sandboxResult.fired && !prevFiredRef.current) {
      playNeuronFire()
    }
    prevFiredRef.current = sandboxResult.fired
  }, [sandboxResult.fired])

  useEffect(() => {
    if (challengeEval.passed && !celebratedRef.current.has(challenge.id)) {
      celebratedRef.current.add(challenge.id)
      setSolvedIds((prev) => new Set(prev).add(challenge.id))
      playSuccess()
      try {
        confetti({ particleCount: 60, spread: 62, origin: { y: 0.7 } })
      } catch {
        // Ignore in headless environments
      }
    }
  }, [challengeEval.passed, challenge.id])

  const resetPark = () => {
    playClick()
    setInputs(scenario.inputs.map((i) => i.defaultValue))
    setWeights(scenario.inputs.map((i) => i.defaultWeight))
    setBias(scenario.bias)
  }

  const selectPuzzle = (id) => {
    playClick()
    setChallengeId(id)
    setCWeights([0.5, 0.5])
    setCBias(0)
    setPreviewRowIdx(0)
    setShowHint(false)
  }

  const meterPct = Math.max(4, Math.min(96, ((sandboxResult.weightedSum + 8) / 16) * 100))

  return (
    <BookChapter
      chapterId={1}
      cliffhangerTitle="Wait — what if there are a MILLION dials?"
      cliffhangerText="Tuning 2 weights by hand for the Treehouse Lock took a little trial and error. Modern AI models have billions of weights! No human could ever adjust them by hand — so in Chapter 2, let's teach a neuron how to learn from its own mistakes."
    >
      {/* Beat 1: Meet the Artificial Neuron */}
      <BookSection num="1" title="Every Giant AI Starts with One Tiny Switch" id="ch1-meet">
        <p className="book-prose">
          Computers don’t have eyes, ears, or feelings — they only work with <strong>numbers</strong>.
          To make decisions, artificial intelligence uses tiny digital brain cells called{' '}
          <TermTip id="perceptron">neurons</TermTip>.
        </p>
        <p className="book-prose">
          A single neuron does three simple things: it checks its <strong>clues</strong> (inputs),
          multiplies each clue by an importance dial called a <TermTip id="weight">weight</TermTip>,
          and adds a starting mood called a <TermTip id="bias">bias</TermTip>. If the total score
          reaches <strong>0 or higher</strong>, the neuron fires <strong>YES!</strong>
        </p>

        {/* Demo 1A: Go to the Park? */}
        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: '1.18rem' }}>
                {scenario.emoji} Try It: {scenario.title}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Tap any clue ON or OFF, and slide the importance weights. Try turning on <strong>Thunderstorm</strong>!
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetPark}>
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>

          <NeuronDiagram
            inputs={inputs}
            labels={scenario.inputs.map((i) => `${i.emoji} ${i.label}`)}
            weights={weights}
            bias={bias}
            result={sandboxResult}
            onToggleInput={(idx) => {
              playClick()
              setInputs((prev) => prev.map((v, i) => (i === idx ? (v ? 0 : 1) : v)))
            }}
          />

          <div className="sum-meter-box">
            <div className="sum-meter-header">
              <span>Neuron Total Score</span>
              <span className="font-mono" style={{ color: sandboxResult.weightedSum >= 0 ? '#059669' : '#dc2626' }}>
                {formatSigned(sandboxResult.weightedSum, 2)} (fires at ≥ 0)
              </span>
            </div>
            <div className="sum-meter-track">
              <div className="sum-meter-zero" />
              <div className="sum-meter-marker" style={{ left: `${meterPct}%` }} />
            </div>
            <div className="sum-meter-scale">
              <span>−8 (Strong NO)</span>
              <span>0 (Threshold)</span>
              <span>+8 (Strong YES)</span>
            </div>
          </div>

          <div className={`decision-banner ${sandboxResult.fired ? 'is-yes' : 'is-no'}`}>
            <span>{sandboxResult.fired ? scenario.yesLabel : scenario.noLabel}</span>
            <span className="badge badge-subtle font-mono">output = {sandboxResult.output}</span>
          </div>

          <div className="control-list">
            {scenario.inputs.map((inp, idx) => (
              <div key={inp.id} className="clue-row">
                <div className="clue-row-top">
                  <button
                    type="button"
                    className={`clue-toggle-btn ${inputs[idx] ? 'is-on' : ''}`}
                    onClick={() => {
                      playClick()
                      setInputs((prev) => prev.map((v, i) => (i === idx ? (v ? 0 : 1) : v)))
                    }}
                  >
                    <span>{inp.emoji}</span>
                    <span>{inp.label}</span>
                    <span className="font-mono">({inputs[idx] ? 'ON' : 'OFF'})</span>
                  </button>
                  <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {inputs[idx]} × {formatSigned(weights[idx])} = {formatSigned(inputs[idx] * weights[idx])}
                  </span>
                </div>
                <div className="weight-slider-row">
                  <span>Weight w{idx + 1}</span>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.5"
                    value={weights[idx]}
                    onChange={(e) => {
                      const nextVal = parseFloat(e.target.value)
                      setWeights((prev) => prev.map((w, i) => (i === idx ? nextVal : w)))
                    }}
                    aria-label={`Weight for ${inp.label}`}
                  />
                  <span className={`weight-val ${weights[idx] > 0 ? 'is-pos' : weights[idx] < 0 ? 'is-neg' : ''}`}>
                    {formatSigned(weights[idx])}
                  </span>
                </div>
              </div>
            ))}

            <div className="clue-row" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
              <div className="weight-slider-row">
                <strong><TermTip id="bias">Bias</TermTip> (Mood)</strong>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={bias}
                  onChange={(e) => setBias(parseFloat(e.target.value))}
                  aria-label="Neuron bias"
                />
                <span className="weight-val" style={{ color: '#4338ca' }}>
                  {formatSigned(bias)}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#3730a3' }}>
                Negative bias makes the neuron picky — it needs stronger YES clues to fire!
              </span>
            </div>
          </div>

          <MathDrawer title="Peek at the Math: Weighted Sum & Activation">
            <p>
              A perceptron computes a weighted sum <code>z = Σ(wᵢ · xᵢ) + b</code> and passes it through a{' '}
              <strong>Step</strong> switch (<code>1</code> if <code>z ≥ 0</code>, else <code>0</code>):
            </p>
            <div className="formula-box">
              z ={' '}
              {sandboxResult.terms
                .map((t) => `(${formatSigned(t.weight)} × ${t.input})`)
                .join(' + ')}{' '}
              + ({formatSigned(bias)}) = <strong>{sandboxResult.weightedSum.toFixed(2)}</strong>
              {'  →  '}step(z) = <strong>{sandboxResult.output}</strong>
            </div>
            <p style={{ fontSize: '0.84rem' }}>
              Later, when networks train automatically, they swap the hard Step switch for a smooth{' '}
              <TermTip id="sigmoid">Sigmoid</TermTip> curve <code>σ(z) = 1 / (1 + e⁻ᶻ)</code> so small weight nudges cause smooth changes.
            </p>
          </MathDrawer>
        </div>

        <div className="book-takeaway">
          <strong>Aha!</strong> Positive weights push a neuron toward <strong>YES</strong>, negative weights act like
          warning signs pushing toward <strong>NO</strong>, and the bias sets how hard it is to convince.
        </div>
      </BookSection>

      {/* Beat 2: Wire a Logic Lock by Hand */}
      <BookSection num="2" title="Your Turn: Wire a Secret Treehouse Lock" id="ch1-puzzle">
        <p className="book-prose">
          Can one tiny neuron actually act like a computer chip? Try tuning the weights and bias below so the
          neuron passes <strong>all 4 test cases</strong> in the table!
        </p>

        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BOOK_PUZZLES.map((item) => {
                const solved = solvedIds.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`neuron-scenario-btn ${challenge.id === item.id ? 'is-active' : ''}`}
                    onClick={() => selectPuzzle(item.id)}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.gate}: {item.title}</span>
                    {solved && <CheckCircle2 size={15} color="#10b981" />}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                playClick()
                setShowHint((h) => !h)
              }}
            >
              <Lightbulb size={14} />
              <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
            </button>
          </div>

          <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)' }}>
            <strong>Mission:</strong> {challenge.story}
          </p>

          {showHint && (
            <div className="callout-kid" style={{ fontSize: '0.88rem' }}>
              💡 <strong>Hint:</strong> {challenge.hint}
            </div>
          )}

          <div className="neuron-main-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <NeuronDiagram
                inputs={previewRow.inputs}
                labels={challenge.inputLabels}
                weights={cWeights}
                bias={cBias}
                result={challengeResult}
              />

              <div className="control-list">
                {challenge.inputLabels.map((lbl, idx) => (
                  <div key={lbl} className="clue-row">
                    <div className="weight-slider-row">
                      <strong>{lbl}</strong>
                      <input
                        type="range"
                        min="-4"
                        max="4"
                        step="0.5"
                        value={cWeights[idx]}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          setCWeights((prev) => prev.map((w, i) => (i === idx ? v : w)))
                        }}
                      />
                      <span className={`weight-val ${cWeights[idx] > 0 ? 'is-pos' : cWeights[idx] < 0 ? 'is-neg' : ''}`}>
                        {formatSigned(cWeights[idx])}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="clue-row" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
                  <div className="weight-slider-row">
                    <strong>Bias</strong>
                    <input
                      type="range"
                      min="-4"
                      max="4"
                      step="0.5"
                      value={cBias}
                      onChange={(e) => setCBias(parseFloat(e.target.value))}
                    />
                    <span className="weight-val" style={{ color: '#4338ca' }}>
                      {formatSigned(cBias)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.96rem' }}>Test Cases (Click a row to preview)</strong>
                <span className={`badge ${challengeEval.passed ? 'badge-success' : 'badge-subtle'}`}>
                  {challengeEval.score}/{challengeEval.total} match
                </span>
              </div>

              <table className="truth-table">
                <thead>
                  <tr>
                    {challenge.inputLabels.map((lbl) => (
                      <th key={lbl}>{lbl.split(' ')[0]}</th>
                    ))}
                    <th>Goal</th>
                    <th>Yours</th>
                    <th>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {challengeEval.results.map((row, idx) => (
                    <tr
                      key={idx}
                      className={previewRowIdx === idx ? 'is-preview' : ''}
                      onClick={() => setPreviewRowIdx(idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      {row.inputs.map((v, i) => (
                        <td key={i} className="font-mono">{v}</td>
                      ))}
                      <td className="font-mono" style={{ fontWeight: 700 }}>{row.expected}</td>
                      <td className="font-mono" style={{ fontWeight: 700 }}>{row.actual}</td>
                      <td>{row.correct ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {challengeEval.passed && (
                <div className="decision-banner is-yes">
                  <span>🎉 You wired the {challenge.gate} gate!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </BookSection>
    </BookChapter>
  )
}
