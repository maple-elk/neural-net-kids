import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Dices,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Sliders,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById } from '../utils/pathwayLoader.js'
import {
  MiniLanguageModel,
  STARTER_CORPORA_LIST,
  detokenizeModelTokens,
  tokenizeForModel,
} from '../engine/miniLlm.js'
import { playSuccess, playTokenPop } from '../utils/sound.js'
import './MiniLlmLab.css'

const CORPUS_PROMPTS = {
  space: ['The silver rocket', 'The brave astronaut', 'On the red planet'],
  dinosaurs: ['The giant dinosaur', 'A tiny triceratops', 'Near the sparkling river'],
  fairytale: ['The clever dragon', 'Inside the crystal castle', 'A brave knight'],
  robots: ['The little robot', 'The clever inventor', 'A tiny drone'],
}

const LOOP_STEPS = [
  { id: 1, title: 'Read Prompt', sub: 'Look at recent words' },
  { id: 2, title: 'Score All Words', sub: 'Apply Temp & Top-K' },
  { id: 3, title: 'Roll Weighted Dice', sub: 'Pick 1 next token' },
  { id: 4, title: 'Append & Repeat', sub: 'Feed back into brain' },
]

function getTemperatureMood(temp) {
  if (temp <= 0.4) {
    return {
      label: 'Predictable Robot 🤖',
      bg: '#e0f2fe',
      color: '#0369a1',
      border: '#7dd3fc',
    }
  }
  if (temp <= 1.15) {
    return {
      label: 'Creative Storyteller ✨',
      bg: '#f5f3ff',
      color: '#6d28d9',
      border: '#c4b5fd',
    }
  }
  return {
    label: 'Wild Chaos 🎲',
    bg: '#fef3c7',
    color: '#b45309',
    border: '#fcd34d',
  }
}

function formatSourceLabel(source) {
  if (source === 'trigram') return '3-word match'
  if (source === 'bigram') return '2-word match'
  return 'vocab fallback'
}

export default function MiniLlmLab() {
  const { isDeepDive, completedStages, markStageComplete, navigate } = useLearning()
  const stage = getStageById(6)
  const isDone = completedStages.has(6)

  const initialCorpus = STARTER_CORPORA_LIST[0]

  // Store trained MiniLanguageModel in state so render stays pure and React-Compiler friendly
  const [model, setModel] = useState(() => {
    const m = new MiniLanguageModel()
    m.train(initialCorpus.text)
    return m
  })

  const [selectedCorpusId, setSelectedCorpusId] = useState(initialCorpus.id)
  const [trainingText, setTrainingText] = useState(initialCorpus.text)
  const [justTrained, setJustTrained] = useState(false)

  // Generation studio state
  const [prompt, setPrompt] = useState(CORPUS_PROMPTS[initialCorpus.id][0])
  const [generatedTokens, setGeneratedTokens] = useState([])
  const [temperature, setTemperature] = useState(0.8)
  const [topK, setTopK] = useState(6)
  const [activeLoopStep, setActiveLoopStep] = useState(2)
  const [lastSampledToken, setLastSampledToken] = useState(null)
  const [isAutoGenerating, setIsAutoGenerating] = useState(false)

  // Refs to keep auto-generation timers clean and always reading latest dials/model
  const autoTimerRef = useRef(null)
  const stepTimersRef = useRef([])
  const modelRef = useRef(model)
  const tempRef = useRef(temperature)
  const topKRef = useRef(topK)
  const tokensRef = useRef([])

  const promptTokens = useMemo(() => tokenizeForModel(prompt), [prompt])
  const allTokens = useMemo(
    () => [...promptTokens, ...generatedTokens],
    [promptTokens, generatedTokens],
  )

  useEffect(() => {
    modelRef.current = model
  }, [model])

  useEffect(() => {
    tempRef.current = temperature
  }, [temperature])

  useEffect(() => {
    topKRef.current = topK
  }, [topK])

  useEffect(() => {
    tokensRef.current = allTokens
  }, [allTokens])

  const clearPendingTimers = useCallback(() => {
    if (autoTimerRef.current) {
      window.clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }
    stepTimersRef.current.forEach((id) => window.clearTimeout(id))
    stepTimersRef.current = []
  }, [])

  useEffect(() => {
    return () => clearPendingTimers()
  }, [clearPendingTimers])

  const stopAutoGenerate = useCallback(() => {
    clearPendingTimers()
    setIsAutoGenerating(false)
    setActiveLoopStep(2)
  }, [clearPendingTimers])

  // Model stats & live probability distribution (reacts immediately to temperature, topK, tokens, and retraining)
  const modelStats = useMemo(() => model.getStats(), [model])

  const distribution = useMemo(
    () => model.getNextTokenDistribution(allTokens, temperature, topK),
    [model, allTokens, temperature, topK],
  )

  const handleSelectCorpus = (corpus) => {
    stopAutoGenerate()
    playSuccess()
    setSelectedCorpusId(corpus.id)
    setTrainingText(corpus.text)
    const nextModel = new MiniLanguageModel()
    nextModel.train(corpus.text)
    setModel(nextModel)
    setPrompt(CORPUS_PROMPTS[corpus.id]?.[0] || 'The')
    setGeneratedTokens([])
    setLastSampledToken(null)
    setJustTrained(true)
    const tid = window.setTimeout(() => setJustTrained(false), 1400)
    stepTimersRef.current.push(tid)
  }

  const handleTrainCustom = () => {
    stopAutoGenerate()
    playSuccess()
    const nextModel = new MiniLanguageModel()
    nextModel.train(trainingText)
    setModel(nextModel)
    setGeneratedTokens([])
    setLastSampledToken(null)
    setJustTrained(true)
    const tid = window.setTimeout(() => setJustTrained(false), 1400)
    stepTimersRef.current.push(tid)
  }

  const handlePromptChange = (nextPrompt) => {
    stopAutoGenerate()
    setPrompt(nextPrompt)
    setGeneratedTokens([])
    setLastSampledToken(null)
    setActiveLoopStep(1)
  }

  const appendSingleToken = useCallback((forcedToken = null) => {
    const currentContext = tokensRef.current
    const sample = forcedToken
      ? { token: forcedToken }
      : modelRef.current.sampleNextToken(currentContext, tempRef.current, topKRef.current)

    if (!sample.token) return false

    setActiveLoopStep(3)
    setLastSampledToken(sample.token)

    const t1 = window.setTimeout(() => {
      setActiveLoopStep(4)
      playTokenPop()
      setGeneratedTokens((prev) => [...prev, sample.token])
    }, 140)

    const t2 = window.setTimeout(() => {
      setActiveLoopStep(2)
    }, 340)

    stepTimersRef.current.push(t1, t2)
    return true
  }, [])

  const handleRollOnce = () => {
    stopAutoGenerate()
    setActiveLoopStep(1)
    const t0 = window.setTimeout(() => {
      setActiveLoopStep(2)
    }, 80)
    const t1 = window.setTimeout(() => {
      appendSingleToken()
    }, 180)
    stepTimersRef.current.push(t0, t1)
  }

  const handleAutoGenerate = () => {
    if (isAutoGenerating) {
      stopAutoGenerate()
      return
    }
    clearPendingTimers()
    setIsAutoGenerating(true)
    let remaining = 10

    const runStep = () => {
      if (remaining <= 0) {
        stopAutoGenerate()
        return
      }
      remaining -= 1
      const ok = appendSingleToken()
      if (!ok) {
        stopAutoGenerate()
      }
    }

    runStep()
    autoTimerRef.current = window.setInterval(runStep, 460)
  }

  const handleResetStory = () => {
    stopAutoGenerate()
    setGeneratedTokens([])
    setLastSampledToken(null)
    setActiveLoopStep(2)
  }

  const handleMarkComplete = () => {
    playSuccess()
    if (!isDone) {
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.72 } })
      } catch {
        // Ignore confetti errors in non-canvas environments
      }
    }
    markStageComplete(6)
  }

  const tempMood = getTemperatureMood(temperature)
  const starterChips = CORPUS_PROMPTS[selectedCorpusId] || ['The', 'Once upon', 'In the']
  const contextPreview = allTokens.slice(-2).join(' ')
  const fullStoryText = detokenizeModelTokens(allTokens)

  return (
    <div className="lab-page minillm-lab">
      {/* Lab Header */}
      <header className="lab-header" style={{ '--stage-accent': stage?.color || '#0ea5e9' }}>
        <div>
          <div className="stage-card-badges">
            <span
              className="badge"
              style={{
                background: '#0ea5e91a',
                color: '#0284c7',
                border: '1px solid #0ea5e944',
              }}
            >
              Stage 6 · {stage?.level || 'Builder'}
            </span>
            <span className="badge badge-subtle">{stage?.ageBadge || 'Ages 11+'}</span>
            {isDone && (
              <span className="badge badge-success">
                <CheckCircle2 size={13} />
                Completed
              </span>
            )}
          </div>
          <h1>{stage?.title || 'Build a Mini-LLM'}</h1>
          <p className="stage-card-subtitle">
            {stage?.subtitle || 'Train a next-word predictor and tune creativity'}
          </p>
        </div>

        <button
          type="button"
          className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
          onClick={handleMarkComplete}
        >
          <CheckCircle2 size={16} />
          <span>{isDone ? 'Stage 6 Completed' : 'Mark Stage 6 Complete'}</span>
        </button>
      </header>

      {/* Mode Overview Callout */}
      <div className={isDeepDive ? 'callout-deep' : 'callout-kid'}>
        <strong>{isDeepDive ? 'Deep-Dive Lens: ' : 'Explorer Mission: '}</strong>
        {isDeepDive
          ? 'Every Large Language Model is fundamentally an autoregressive next-token predictor modeling P(xₜ | x₁…xₜ₋₁). Here you will train a live trigram/bigram backoff model in your browser and directly inspect how Temperature logit-scaling and Top-K truncation reshape the sampling distribution.'
          : 'How do AI chatbots write whole stories? One word at a time! Train your very own Mini-LLM on a story below, watch it calculate the odds for every possible next word, and slide the Temperature dial from Predictable Robot to Wild Chaos!'}
      </div>

      {/* ================================================================
          PANEL 1: TRAIN YOUR OWN MINI-BRAIN
         ================================================================ */}
      <section className="lab-card minillm-section" aria-labelledby="train-brain-title">
        <div className="minillm-section-head">
          <div>
            <div className="minillm-section-title-row">
              <span className="minillm-section-num">1</span>
              <h2 id="train-brain-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Brain size={20} color="#0284c7" />
                Train Your Own Mini-Brain
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem', marginTop: 4 }}>
              Pick a themed training library or type your own stories below, then click <strong>Train Mini-LLM</strong> to teach it which words follow which!
            </p>
          </div>
        </div>

        <div className="corpus-grid" role="group" aria-label="Starter training corpora">
          {STARTER_CORPORA_LIST.map((corpus) => (
            <button
              key={corpus.id}
              type="button"
              className={`corpus-card ${selectedCorpusId === corpus.id ? 'is-active' : ''}`}
              onClick={() => handleSelectCorpus(corpus)}
            >
              <span className="corpus-card-title">
                <span>{corpus.emoji}</span>
                <span>{corpus.title}</span>
              </span>
              <span className="corpus-card-desc">{corpus.description}</span>
            </button>
          ))}
        </div>

        <div className="corpus-editor-wrap">
          <label
            htmlFor="training-corpus-textarea"
            style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}
          >
            Training Text (Edit or paste your own story!)
          </label>
          <textarea
            id="training-corpus-textarea"
            className="corpus-textarea"
            value={trainingText}
            onChange={(e) => setTrainingText(e.target.value)}
            placeholder="Write a few sentences here and click Train Mini-LLM..."
          />
        </div>

        <div className="train-action-bar">
          <button
            type="button"
            className={`btn ${justTrained ? 'btn-success' : 'btn-sky'}`}
            onClick={handleTrainCustom}
          >
            <Sparkles size={16} />
            <span>{justTrained ? 'Mini-LLM Trained!' : 'Train Mini-LLM'}</span>
          </button>

          <div className="brain-stats-grid" aria-live="polite">
            <div className="brain-stat">
              <span>Vocab Size:</span>
              <strong>{modelStats.vocabSize}</strong>
            </div>
            <div className="brain-stat">
              <span>Word-Pair Transitions:</span>
              <strong>{modelStats.bigramCount}</strong>
            </div>
            <div className="brain-stat">
              <span>3-Word Patterns:</span>
              <strong>{modelStats.trigramCount}</strong>
            </div>
            <div className="brain-stat">
              <span>Tokens Read:</span>
              <strong>{modelStats.tokenCount}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          PANEL 2: INTERACTIVE GENERATION STUDIO
         ================================================================ */}
      <section className="lab-card minillm-section" aria-labelledby="gen-studio-title">
        <div className="minillm-section-head">
          <div>
            <div className="minillm-section-title-row">
              <span className="minillm-section-num">2</span>
              <h2 id="gen-studio-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Dices size={20} color="#0284c7" />
                Interactive Generation Studio
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem', marginTop: 4 }}>
              Roll the weighted dice to generate one token at a time, or hit Auto-Generate and watch the 4-step autoregressive loop in action!
            </p>
          </div>
        </div>

        {/* 4-Step Autoregressive Loop Strip */}
        <div className="loop-strip" aria-label="Autoregressive generation loop">
          {LOOP_STEPS.map((step) => (
            <div
              key={step.id}
              className={`loop-step ${activeLoopStep === step.id ? 'is-active' : ''}`}
            >
              <span className="loop-step-badge">{step.id}</span>
              <div className="loop-step-text">
                <span className="loop-step-title">{step.title}</span>
                <span className="loop-step-sub">{step.sub}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="studio-grid">
          {/* Left Column: Prompt, Story Output, Generation Controls */}
          <div className="studio-left">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                htmlFor="prompt-input"
                style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}
              >
                Starting Prompt
              </label>
              <input
                id="prompt-input"
                type="text"
                className="prompt-input"
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Type a starter phrase..."
              />
              <div className="prompt-chips">
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Starters:
                </span>
                {starterChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="prompt-chip"
                    onClick={() => handlePromptChange(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Generated Story Output */}
            <div className="story-output-box" aria-live="polite">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Live Generated Story
                </span>
                <span className="badge badge-subtle">
                  +{generatedTokens.length} generated {generatedTokens.length === 1 ? 'token' : 'tokens'}
                </span>
              </div>

              <div className="story-tokens-flow">
                {promptTokens.length === 0 && generatedTokens.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    Type a prompt or click &ldquo;Roll Weighted Dice&rdquo; to start generating!
                  </span>
                ) : (
                  <>
                    {promptTokens.map((tok, i) => (
                      <span key={`p-${i}`} className="story-token-prompt">
                        {tok}
                      </span>
                    ))}
                    {generatedTokens.map((tok, i) => (
                      <span
                        key={`g-${i}`}
                        className={`story-token-gen ${i === generatedTokens.length - 1 ? 'is-latest' : ''}`}
                      >
                        {tok}
                      </span>
                    ))}
                  </>
                )}
              </div>

              {generatedTokens.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: 8 }}>
                  <strong>Plain text:</strong> {fullStoryText}
                </div>
              )}
            </div>

            {/* Generation Action Buttons */}
            <div className="gen-controls">
              <button
                type="button"
                className="btn btn-sky"
                onClick={handleRollOnce}
                disabled={modelStats.vocabSize === 0}
              >
                <Dices size={17} />
                <span>Roll Weighted Dice (+1 Token)</span>
              </button>

              <button
                type="button"
                className={`btn ${isAutoGenerating ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleAutoGenerate}
                disabled={modelStats.vocabSize === 0}
              >
                {isAutoGenerating ? <Square size={15} /> : <Play size={15} />}
                <span>{isAutoGenerating ? 'Stop Generating' : 'Auto-Generate (+10 Tokens)'}</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetStory}
              >
                <RotateCcw size={15} />
                <span>Reset</span>
              </button>
            </div>

            {isDeepDive && (
              <div className="callout-deep" style={{ fontSize: '0.84rem' }}>
                <strong>Temperature-Scaled Softmax:</strong> Lowering <code>T → 0.1</code> exaggerates the top logit (greedy decoding). Raising <code>T → 2.0</code> compresses logit gaps so probabilities approach uniform randomness.
                <div className="formula-box" style={{ marginTop: 8 }}>
                  P(wᵢ) = exp(log(scoreᵢ) / T) / Σⱼ exp(log(scoreⱼ) / T)
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Temperature & Top-K Dials + Live Probability Bar Chart */}
          <div className="studio-right">
            <div className="dials-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.92rem' }}>
                <Sliders size={16} color="#0284c7" />
                <span>Creativity Controls (Live Update!)</span>
              </div>

              <div className="dial-row">
                <div className="dial-header">
                  <label htmlFor="temp-slider">
                    Temperature: <span className="font-mono">{temperature.toFixed(2)}</span>
                  </label>
                  <span
                    className="dial-mood-badge"
                    style={{
                      background: tempMood.bg,
                      color: tempMood.color,
                      border: `1px solid ${tempMood.border}`,
                    }}
                  >
                    {tempMood.label}
                  </span>
                </div>
                <input
                  id="temp-slider"
                  type="range"
                  min="0.1"
                  max="1.8"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="dial-slider"
                />
                <div className="dial-scale">
                  <span>0.1 Predictable Robot 🤖</span>
                  <span>0.8 Storyteller ✨</span>
                  <span>1.8 Wild Chaos 🎲</span>
                </div>
              </div>

              <div className="dial-row">
                <div className="dial-header">
                  <label htmlFor="topk-slider">
                    Top-K Candidates: <span className="font-mono">{topK}</span>
                  </label>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Keep top {topK} next words
                  </span>
                </div>
                <input
                  id="topk-slider"
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="dial-slider"
                />
                <div className="dial-scale">
                  <span>2 (Super Focused)</span>
                  <span>6 (Balanced)</span>
                  <span>10 (Wide Pool)</span>
                </div>
              </div>
            </div>

            {/* Live Next-Token Probability Bar Chart */}
            <div className="prob-chart-card">
              <div className="prob-chart-head">
                <div>
                  <h3 style={{ fontSize: '1.02rem' }}>Next-Token Probabilities</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    After{' '}
                    <strong className="font-mono">
                      &ldquo;{contextPreview || '(start)'}&rdquo;
                    </strong>{' '}
                    — drag Temperature or click any bar to pick it!
                  </p>
                </div>
              </div>

              <div className="prob-list" role="list">
                {distribution.length === 0 ? (
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                    Train the Mini-LLM on some text first to see next-word odds!
                  </p>
                ) : (
                  distribution.map((item) => {
                    const pct = item.probability * 100
                    const isJustSampled = lastSampledToken === item.token
                    return (
                      <button
                        key={item.token}
                        type="button"
                        role="listitem"
                        className={`prob-row ${isJustSampled ? 'is-sampled' : ''}`}
                        onClick={() => {
                          stopAutoGenerate()
                          appendSingleToken(item.token)
                        }}
                        title={`Click to manually append "${item.token}"`}
                      >
                        <div className="prob-token-col">
                          <span className="prob-token-word">{item.token}</span>
                          <span className="prob-source-tag">
                            {formatSourceLabel(item.source)}
                          </span>
                        </div>
                        <div className="prob-bar-track" aria-hidden="true">
                          <div
                            className="prob-bar-fill"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                        <span className="prob-pct">{pct.toFixed(1)}%</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 3: HOW REAL LLMs SCALE THIS UP
         ================================================================ */}
      <section className="lab-card minillm-section" aria-labelledby="scale-up-title">
        <div>
          <h2 id="scale-up-title" style={{ fontSize: '1.3rem', marginBottom: 4 }}>
            How Real LLMs Scale This Up 🚀
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem' }}>
            Your Mini-LLM just learned from ~100 words in milliseconds. Frontier AI models like ChatGPT, Claude, and Gemini use the exact same next-token prediction idea—scaled up in three big stages:
          </p>
        </div>

        <div className="scale-grid">
          <div className="scale-card">
            <span className="scale-step-pill">Step 1 · Pretraining</span>
            <h3>Read Billions of Pages</h3>
            <p>
              Instead of 8 sentences, a massive Transformer neural network reads trillions of tokens from books, websites, and code—using the Self-Attention from Stage 5 to predict the next token with uncanny accuracy.
            </p>
          </div>

          <div className="scale-card">
            <span className="scale-step-pill">Step 2 · Fine-Tuning</span>
            <h3>Practice Helpful Chats</h3>
            <p>
              A pretrained model just continues text like a storyteller. Supervised Fine-Tuning (SFT) trains it on thousands of high-quality question-and-answer examples so it learns to follow instructions.
            </p>
          </div>

          <div className="scale-card">
            <span className="scale-step-pill">Step 3 · RLHF</span>
            <h3>Learn from Human Feedback</h3>
            <p>
              Humans rate which answers are most helpful, honest, and safe. Using Reinforcement Learning from Human Feedback (RLHF), the AI polishes its manners—ready for the big history story in Stage 7!
            </p>
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <nav className="lab-footer-nav" aria-label="Stage navigation">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/stage/5')}
        >
          <ArrowLeft size={16} />
          <span>Stage 5: Words, Vectors &amp; Attention</span>
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
            onClick={handleMarkComplete}
          >
            <CheckCircle2 size={16} />
            <span>{isDone ? 'Stage 6 Completed' : 'Mark Stage 6 Complete'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/stage/7')}
          >
            <span>Next: Stage 7 →</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>
    </div>
  )
}
