import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Puzzle,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react'
import {
  PERCEPTRON_CHALLENGES,
  PERCEPTRON_SCENARIOS,
  checkPerceptronChallenge,
  computePerceptron,
  sigmoid,
} from '../engine/perceptron.js'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById } from '../utils/pathwayLoader.js'
import { playClick, playNeuronFire, playSuccess } from '../utils/sound.js'
import TermTip from '../components/TermTip.jsx'
import './NeuronLab.css'

function formatSigned(val, decimals = 1) {
  const fixed = Number(val).toFixed(decimals)
  return Number(val) > 0 ? `+${fixed}` : fixed
}

function ActivationMiniPlot({ activation, z, output }) {
  const width = 220
  const height = 96
  const pad = 14
  const mapX = (val) => pad + ((Math.max(-6, Math.min(6, val)) + 6) / 12) * (width - pad * 2)
  const mapY = (val) => height - pad - val * (height - pad * 2)

  let pathD = ''
  if (activation === 'step') {
    const x0 = mapX(-6)
    const xm = mapX(0)
    const x1 = mapX(6)
    pathD = `M ${x0} ${mapY(0)} L ${xm} ${mapY(0)} L ${xm} ${mapY(1)} L ${x1} ${mapY(1)}`
  } else {
    const pts = []
    for (let i = 0; i <= 48; i += 1) {
      const zv = -6 + (12 * i) / 48
      pts.push(`${i === 0 ? 'M' : 'L'} ${mapX(zv).toFixed(1)} ${mapY(sigmoid(zv)).toFixed(1)}`)
    }
    pathD = pts.join(' ')
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label="Activation curve">
      <rect x="0" y="0" width={width} height={height} rx="10" fill="#0f172a" />
      <line x1={pad} y1={mapY(0)} x2={width - pad} y2={mapY(0)} stroke="#334155" strokeWidth="1" />
      <line x1={pad} y1={mapY(1)} x2={width - pad} y2={mapY(1)} stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
      <line x1={mapX(0)} y1={pad} x2={mapX(0)} y2={height - pad} stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />
      <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={mapX(z)} cy={mapY(output)} r="5.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
      <text x={width - pad} y={pad + 8} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="monospace">
        {activation === 'step' ? 'step(z)' : 'σ(z)'}
      </text>
    </svg>
  )
}

function NeuronDiagram({
  inputs,
  labels,
  weights,
  bias,
  result,
  activation,
  onToggleInput,
  isDeepDive,
}) {
  const count = inputs.length
  const svgW = 540
  const svgH = Math.max(250, count * 68 + 46)
  const inputX = 94
  const somaX = 310
  const somaY = svgH / 2
  const outX = 468

  const getInputY = (idx) => {
    if (count === 1) return somaY
    const top = 46
    const bottom = svgH - 54
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

        {/* Connection edges from inputs to soma */}
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

        {/* Output connection */}
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

        {/* Bias feeder from bottom */}
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

        {/* Input nodes */}
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
              <text
                x="22"
                y={y - 3}
                fontSize="11"
                fontWeight="700"
                fill="#0f172a"
              >
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
                x{idx + 1} = {val} {onToggleInput ? '(tap)' : ''}
              </text>
            </g>
          )
        })}

        {/* Neuron Soma */}
        <g transform={`translate(${somaX}, ${somaY})`}>
          <circle
            r="44"
            fill={result.fired ? '#fffbeb' : '#ffffff'}
            stroke={result.fired ? '#f59e0b' : '#94a3b8'}
            strokeWidth="3.5"
          />
          <text x="0" y="-10" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">
            {isDeepDive ? 'Σ w·x + b' : 'Total Score'}
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
            {activation === 'sigmoid' ? 'sigmoid' : 'step ≥ 0'}
          </text>
        </g>

        {/* Output Bulb / Spark */}
        <g transform={`translate(${outX}, ${somaY})`}>
          {result.fired && (
            <>
              <circle r="52" fill="url(#bulbGlow)" />
              <circle
                r="40"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                className="neuron-spark-ring"
              />
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
            y="-4"
            textAnchor="middle"
            fontSize="15"
            fontWeight="800"
            fill={result.fired ? '#ffffff' : '#475569'}
          >
            {result.fired ? 'FIRE!' : 'OFF'}
          </text>
          <text
            x="0"
            y="14"
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
            fill={result.fired ? '#fef3c7' : '#64748b'}
          >
            {activation === 'sigmoid'
              ? `${Math.round(result.output * 100)}%`
              : `y = ${result.output}`}
          </text>
        </g>
      </svg>
    </div>
  )
}

export default function NeuronLab() {
  const { isDeepDive, completedStages, markStageComplete, navigate } = useLearning()
  const stage = getStageById(1)

  const [tab, setTab] = useState('sandbox')
  const [activation, setActivation] = useState('step')

  // Sandbox state
  const [scenarioId, setScenarioId] = useState(PERCEPTRON_SCENARIOS[0].id)
  const scenario = useMemo(
    () => PERCEPTRON_SCENARIOS.find((s) => s.id === scenarioId) || PERCEPTRON_SCENARIOS[0],
    [scenarioId],
  )
  const [inputs, setInputs] = useState(() => scenario.inputs.map((i) => i.defaultValue))
  const [weights, setWeights] = useState(() => scenario.inputs.map((i) => i.defaultWeight))
  const [bias, setBias] = useState(() => scenario.bias)

  // Challenge state
  const [challengeId, setChallengeId] = useState(PERCEPTRON_CHALLENGES[0].id)
  const challenge = useMemo(
    () => PERCEPTRON_CHALLENGES.find((c) => c.id === challengeId) || PERCEPTRON_CHALLENGES[0],
    [challengeId],
  )
  const [cWeights, setCWeights] = useState(() => challenge.inputLabels.map(() => 0.5))
  const [cBias, setCBias] = useState(0)
  const [previewRowIdx, setPreviewRowIdx] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [solvedIds, setSolvedIds] = useState(() => new Set())
  const celebratedRef = useRef(new Set())

  const selectScenario = (nextId) => {
    const found = PERCEPTRON_SCENARIOS.find((s) => s.id === nextId)
    if (!found) return
    setScenarioId(found.id)
    setInputs(found.inputs.map((i) => i.defaultValue))
    setWeights(found.inputs.map((i) => i.defaultWeight))
    setBias(found.bias)
  }

  const selectChallenge = (nextId) => {
    const found = PERCEPTRON_CHALLENGES.find((c) => c.id === nextId)
    if (!found) return
    setChallengeId(found.id)
    setCWeights(found.inputLabels.map(() => 0.5))
    setCBias(0)
    setPreviewRowIdx(0)
    setShowHint(false)
  }

  const sandboxResult = useMemo(
    () => computePerceptron(inputs, weights, bias, activation),
    [inputs, weights, bias, activation],
  )

  const challengeEval = useMemo(
    () => checkPerceptronChallenge(challenge, cWeights, cBias, activation),
    [challenge, cWeights, cBias, activation],
  )

  const previewRow = challenge.truthTable[previewRowIdx] || challenge.truthTable[0]
  const challengeDiagramResult = useMemo(
    () => computePerceptron(previewRow.inputs, cWeights, cBias, activation),
    [previewRow, cWeights, cBias, activation],
  )

  useEffect(() => {
    if (tab === 'challenges' && challengeEval.passed && !celebratedRef.current.has(challenge.id)) {
      celebratedRef.current.add(challenge.id)
      setSolvedIds((prev) => new Set(prev).add(challenge.id))
      playSuccess()
      confetti({
        particleCount: 65,
        spread: 65,
        origin: { y: 0.65 },
      })
    }
  }, [tab, challengeEval.passed, challenge.id])

  const activeResult = tab === 'sandbox' ? sandboxResult : challengeDiagramResult
  const prevFiredRef = useRef(activeResult.fired)
  useEffect(() => {
    if (activeResult.fired && !prevFiredRef.current) {
      playNeuronFire()
    }
    prevFiredRef.current = activeResult.fired
  }, [activeResult.fired])
  const meterPct = Math.max(4, Math.min(96, ((activeResult.weightedSum + 8) / 16) * 100))
  const isDone = completedStages.has(1)

  return (
    <div className="lab-page">
      <header className="lab-header" style={{ '--stage-accent': stage?.color || '#f59e0b' }}>
        <div>
          <div className="stage-card-badges">
            <span
              className="badge"
              style={{ background: '#f59e0b1a', color: '#b45309', border: '1px solid #f59e0b55' }}
            >
              Stage 1 · {stage?.level || 'Beginner'}
            </span>
            <span className="badge badge-subtle">{stage?.ageBadge || 'Ages 8+'}</span>
            {isDone && (
              <span className="badge badge-success">
                <CheckCircle2 size={13} />
                Completed
              </span>
            )}
          </div>
          <h1>{stage?.title || 'Meet the Neuron'}</h1>
          <p className="stage-card-subtitle">
            {stage?.subtitle || 'How one tiny artificial neuron weighs clues to make a decision.'}
          </p>
        </div>

        <div className="neuron-tabs" role="tablist" aria-label="Neuron lab mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sandbox'}
            className={`neuron-tab-btn ${tab === 'sandbox' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('sandbox')
              playClick()
            }}
          >
            <Zap size={16} />
            <span>Neuron Sandbox</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'challenges'}
            className={`neuron-tab-btn ${tab === 'challenges' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('challenges')
              playClick()
            }}
          >
            <Puzzle size={16} />
            <span>Logic Puzzles ({solvedIds.size}/{PERCEPTRON_CHALLENGES.length})</span>
          </button>
        </div>
      </header>

      <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
        {isDeepDive ? (
          <>
            <strong><TermTip id="perceptron">Perceptron</TermTip> Model:</strong> Computes a linear combination{' '}
            <code>z = Σ(wᵢ · xᵢ) + b</code> and passes it through either a <TermTip id="step">Step</TermTip> function{' '}
            <code>u(z)</code> or logistic <TermTip id="sigmoid">Sigmoid</TermTip> <code>σ(z) = 1 / (1 + e⁻ᶻ)</code>.
          </>
        ) : (
          <>
            <strong>How it works:</strong> An artificial neuron checks clues (inputs), multiplies each
            clue by how important it is (<TermTip id="weight">weight</TermTip>), adds a starting nudge (<TermTip id="bias">bias</TermTip>), and fires if the total
            score reaches <strong>0 or higher</strong>!
          </>
        )}
      </div>

      {tab === 'sandbox' ? (
        <>
          <div className="neuron-picker-row">
            {PERCEPTRON_SCENARIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`neuron-scenario-btn ${scenario.id === item.id ? 'is-active' : ''}`}
                onClick={() => selectScenario(item.id)}
              >
                <span aria-hidden="true">{item.emoji}</span>
                <span>{item.title}</span>
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => selectScenario(scenario.id)}
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>
          </div>

          <div className="neuron-main-grid">
            <section className="lab-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem' }}>
                    {scenario.emoji} {scenario.title}
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {scenario.description}
                  </p>
                </div>
              </div>

              <NeuronDiagram
                inputs={inputs}
                labels={scenario.inputs.map((i) => `${i.emoji} ${i.label}`)}
                weights={weights}
                bias={bias}
                result={sandboxResult}
                activation={activation}
                onToggleInput={(idx) =>
                  setInputs((prev) => prev.map((v, i) => (i === idx ? (v ? 0 : 1) : v)))
                }
                isDeepDive={isDeepDive}
              />

              <div className="sum-meter-box">
                <div className="sum-meter-header">
                  <span>{isDeepDive ? 'Pre-activation z = w·x + b' : 'Neuron Total Score'}</span>
                  <span className="font-mono" style={{ color: sandboxResult.weightedSum >= 0 ? '#059669' : '#dc2626' }}>
                    {formatSigned(sandboxResult.weightedSum, 2)} (fires at ≥ 0)
                  </span>
                </div>
                <div className="sum-meter-track">
                  <div className="sum-meter-zero" />
                  <div className="sum-meter-marker" style={{ left: `${meterPct}%` }} />
                </div>
                <div className="sum-meter-scale">
                  <span>-8 (Strong NO)</span>
                  <span>0 (Threshold)</span>
                  <span>+8 (Strong YES)</span>
                </div>
              </div>

              <div className={`decision-banner ${sandboxResult.fired ? 'is-yes' : 'is-no'}`}>
                <span>{sandboxResult.fired ? scenario.yesLabel : scenario.noLabel}</span>
                <span className="badge badge-subtle font-mono">
                  {activation === 'sigmoid'
                    ? `${(sandboxResult.output * 100).toFixed(1)}% sure`
                    : `output = ${sandboxResult.output}`}
                </span>
              </div>

              {!isDeepDive && (
                <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  💡 <strong>Tip:</strong> {scenario.kidTip}
                </p>
              )}
            </section>

            <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.08rem', marginBottom: 4 }}>
                  Clues &amp; Importance <TermTip id="weight">Weights</TermTip>
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Toggle each clue ON/OFF and drag its weight slider. Positive = vote YES, Negative = vote NO.
                </p>
              </div>

              <div className="control-list">
                {scenario.inputs.map((inp, idx) => (
                  <div key={inp.id} className="clue-row">
                    <div className="clue-row-top">
                      <button
                        type="button"
                        className={`clue-toggle-btn ${inputs[idx] ? 'is-on' : ''}`}
                        onClick={() =>
                          setInputs((prev) => prev.map((v, i) => (i === idx ? (v ? 0 : 1) : v)))
                        }
                      >
                        <span>{inp.emoji}</span>
                        <span>{inp.label}</span>
                        <span className="font-mono">({inputs[idx] ? 'ON' : 'OFF'})</span>
                      </button>
                      <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        contrib: {formatSigned(inputs[idx] * weights[idx], 1)}
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
                    <strong><TermTip id="bias">Bias</TermTip> (b)</strong>
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
                  <span style={{ fontSize: '0.78rem', color: '#3730a3' }}>
                    {isDeepDive
                      ? 'Shifts the hyperplane threshold: fires when w·x ≥ −b.'
                      : 'Sets how picky the neuron is! Negative bias needs stronger YES votes.'}
                  </span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.92rem', marginBottom: 8 }}>
                  <TermTip id="activation">Activation Function</TermTip>{' '}
                  <span style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    (<TermTip id="step">Step</TermTip> vs <TermTip id="sigmoid">Sigmoid</TermTip>)
                  </span>
                </h4>
                <div className="activation-toggle">
                  <button
                    type="button"
                    className={`activation-btn ${activation === 'step' ? 'is-active' : ''}`}
                    onClick={() => setActivation('step')}
                  >
                    Step (0 or 1 Switch)
                  </button>
                  <button
                    type="button"
                    className={`activation-btn ${activation === 'sigmoid' ? 'is-active' : ''}`}
                    onClick={() => setActivation('sigmoid')}
                  >
                    Sigmoid (Smooth %)
                  </button>
                </div>
              </div>

              {isDeepDive && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="formula-box">
                    <div>
                      z ={' '}
                      {sandboxResult.terms
                        .map((t) => `(${formatSigned(t.weight)}×${t.input})`)
                        .join(' + ')}{' '}
                      + ({formatSigned(bias)}) = <strong>{sandboxResult.weightedSum.toFixed(2)}</strong>
                    </div>
                    <div style={{ marginTop: 4, color: '#38bdf8' }}>
                      {activation === 'sigmoid'
                        ? `σ(z) = 1 / (1 + e^(${(-sandboxResult.weightedSum).toFixed(2)})) = ${sandboxResult.output.toFixed(4)}`
                        : `step(z) = (z >= 0 ? 1 : 0) = ${sandboxResult.output}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ActivationMiniPlot
                      activation={activation}
                      z={sandboxResult.weightedSum}
                      output={sandboxResult.output}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="neuron-picker-row">
            {PERCEPTRON_CHALLENGES.map((item) => {
              const solved = solvedIds.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`neuron-scenario-btn ${challenge.id === item.id ? 'is-active' : ''}`}
                  onClick={() => selectChallenge(item.id)}
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <span>
                    {item.gate}: {item.title}
                  </span>
                  {solved && <CheckCircle2 size={16} color="#10b981" />}
                </button>
              )
            })}
          </div>

          <div className="neuron-main-grid">
            <section className="lab-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                  <span className="badge badge-explorer" style={{ marginBottom: 6 }}>
                    {challenge.gate} Gate Puzzle
                  </span>
                  <h2 style={{ fontSize: '1.25rem' }}>
                    {challenge.emoji} {challenge.title}
                  </h2>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {challenge.story}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowHint((h) => !h)}
                >
                  <Lightbulb size={15} />
                  <span>{showHint ? 'Hide Hint' : 'Hint'}</span>
                </button>
              </div>

              {showHint && (
                <div className="callout-kid" style={{ marginBottom: 14, fontSize: '0.86rem' }}>
                  💡 <strong>Hint:</strong> {challenge.hint}
                </div>
              )}

              <NeuronDiagram
                inputs={previewRow.inputs}
                labels={challenge.inputLabels}
                weights={cWeights}
                bias={cBias}
                result={challengeDiagramResult}
                activation={activation}
                isDeepDive={isDeepDive}
              />

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Click any row in the Truth Table on the right to preview how your neuron behaves on those inputs.
              </p>
            </section>

            <section className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.08rem' }}>Tune Weights &amp; Bias</h3>
                <span className={`badge ${challengeEval.passed ? 'badge-success' : 'badge-subtle'}`}>
                  {challengeEval.score}/{challengeEval.total} rows match
                </span>
              </div>

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
                    <strong>Bias (b)</strong>
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

              {challengeEval.passed && (
                <div className="decision-banner is-yes" style={{ marginTop: 2 }}>
                  <span>
                    <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    You solved the {challenge.gate} puzzle!
                  </span>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table className="truth-table">
                  <thead>
                    <tr>
                      {challenge.inputLabels.map((lbl, idx) => (
                        <th key={lbl}>x{idx + 1}</th>
                      ))}
                      <th>Score z</th>
                      <th>Goal</th>
                      <th>Yours</th>
                      <th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challengeEval.results.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`${previewRowIdx === idx ? 'is-preview' : ''} ${row.correct ? 'is-pass' : 'is-fail'}`}
                        onClick={() => setPreviewRowIdx(idx)}
                      >
                        {row.inputs.map((v, i) => (
                          <td key={i} className="font-mono">
                            {v}
                          </td>
                        ))}
                        <td className="font-mono">{formatSigned(row.weightedSum, 1)}</td>
                        <td className="font-mono">{row.expected}</td>
                        <td className="font-mono">{row.actual}</td>
                        <td>{row.correct ? '✅ Pass' : '❌ Try again'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}

      <nav className="lab-footer-nav" aria-label="Stage 1 navigation">
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          <span>Pathway Map</span>
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => {
              markStageComplete(1)
              playSuccess()
            }}
          >
            <CheckCircle2 size={16} />
            <span>{isDone ? 'Stage 1 Completed' : 'Mark Stage 1 Complete'}</span>
          </button>

          <button type="button" className="btn btn-primary" onClick={() => navigate('/stage/2')}>
            <span>Next: Stage 2 →</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>
    </div>
  )
}
