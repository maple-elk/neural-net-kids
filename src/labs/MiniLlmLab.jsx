import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dices, Play, RotateCcw, Sparkles, Square } from 'lucide-react'
import {
  MiniLanguageModel,
  STARTER_CORPORA_LIST,
  detokenizeModelTokens,
  tokenizeForModel,
} from '../engine/miniLlm.js'
import { playClick, playSuccess, playTokenPop } from '../utils/sound.js'
import BookChapter, { BonusDrawer, BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './MiniLlmLab.css'

const CORPUS_PROMPTS = {
  space: ['The silver rocket', 'The brave astronaut', 'On the red planet'],
  dinosaurs: ['The giant dinosaur', 'A tiny triceratops', 'Near the sparkling river'],
  fairytale: ['The clever dragon', 'Inside the crystal castle', 'A brave knight'],
  robots: ['The little robot', 'The clever inventor', 'A tiny drone'],
}

function getTemperatureMood(temp) {
  if (temp <= 0.4) return { label: 'Predictable Robot 🤖', bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' }
  if (temp <= 1.15) return { label: 'Creative Storyteller ✨', bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd' }
  return { label: 'Wild Chaos 🎲', bg: '#fef3c7', color: '#b45309', border: '#fcd34d' }
}

export default function MiniLlmLab() {
  const initialCorpus = STARTER_CORPORA_LIST[0]
  const [model, setModel] = useState(() => {
    const m = new MiniLanguageModel()
    m.train(initialCorpus.text)
    return m
  })
  const [selectedCorpusId, setSelectedCorpusId] = useState(initialCorpus.id)
  const [trainingText, setTrainingText] = useState(initialCorpus.text)
  const [justTrained, setJustTrained] = useState(false)

  const [prompt, setPrompt] = useState(CORPUS_PROMPTS[initialCorpus.id][0])
  const [generatedTokens, setGeneratedTokens] = useState([])
  const [temperature, setTemperature] = useState(0.8)
  const [topK, setTopK] = useState(6)
  const [lastSampledToken, setLastSampledToken] = useState(null)
  const [isAutoGenerating, setIsAutoGenerating] = useState(false)

  const autoTimerRef = useRef(null)
  const stepTimersRef = useRef([])
  const modelRef = useRef(model)
  const tempRef = useRef(temperature)
  const topKRef = useRef(topK)
  const tokensRef = useRef([])

  const promptTokens = useMemo(() => tokenizeForModel(prompt), [prompt])
  const allTokens = useMemo(() => [...promptTokens, ...generatedTokens], [promptTokens, generatedTokens])

  useEffect(() => { modelRef.current = model }, [model])
  useEffect(() => { tempRef.current = temperature }, [temperature])
  useEffect(() => { topKRef.current = topK }, [topK])
  useEffect(() => { tokensRef.current = allTokens }, [allTokens])

  const clearTimers = useCallback(() => {
    if (autoTimerRef.current) {
      window.clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }
    stepTimersRef.current.forEach((id) => window.clearTimeout(id))
    stepTimersRef.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const stopAuto = useCallback(() => {
    clearTimers()
    setIsAutoGenerating(false)
  }, [clearTimers])

  const modelStats = useMemo(() => model.getStats(), [model])
  const distribution = useMemo(
    () => model.getNextTokenDistribution(allTokens, temperature, topK),
    [model, allTokens, temperature, topK],
  )

  const selectCorpus = (corpus) => {
    stopAuto()
    playSuccess()
    setSelectedCorpusId(corpus.id)
    setTrainingText(corpus.text)
    const next = new MiniLanguageModel()
    next.train(corpus.text)
    setModel(next)
    setPrompt(CORPUS_PROMPTS[corpus.id]?.[0] || 'The')
    setGeneratedTokens([])
    setLastSampledToken(null)
  }

  const trainCustom = () => {
    stopAuto()
    playSuccess()
    const next = new MiniLanguageModel()
    next.train(trainingText)
    setModel(next)
    setGeneratedTokens([])
    setLastSampledToken(null)
    setJustTrained(true)
    const tid = window.setTimeout(() => setJustTrained(false), 1400)
    stepTimersRef.current.push(tid)
  }

  const appendOne = useCallback((forcedToken = null) => {
    const sample = forcedToken
      ? { token: forcedToken }
      : modelRef.current.sampleNextToken(tokensRef.current, tempRef.current, topKRef.current)
    if (!sample.token) return false
    setLastSampledToken(sample.token)
    playTokenPop()
    setGeneratedTokens((prev) => [...prev, sample.token])
    return true
  }, [])

  const toggleAuto = () => {
    if (isAutoGenerating) {
      stopAuto()
      return
    }
    clearTimers()
    setIsAutoGenerating(true)
    let remaining = 10
    const step = () => {
      if (remaining <= 0) {
        stopAuto()
        return
      }
      remaining -= 1
      if (!appendOne()) stopAuto()
    }
    step()
    autoTimerRef.current = window.setInterval(step, 420)
  }

  const tempMood = getTemperatureMood(temperature)
  const starterChips = CORPUS_PROMPTS[selectedCorpusId] || ['The']
  const contextPreview = allTokens.slice(-2).join(' ')
  const fullStoryText = detokenizeModelTokens(allTokens)

  return (
    <BookChapter
      chapterId={7}
      recapFromPrev="In Chapters 5 & 6, you saw how AI turns words into Meaning Maps and uses Self-Attention to read in context. Now let’s make it write!"
      cliffhangerTitle="You just built every piece of modern AI!"
      cliffhangerText="From a single 1943 math neuron to a text-generating Mini-LLM, you've experienced the entire stack! Turn to Chapter 8 to zoom out across the 4 families of AI brains and 80 years of breakthroughs."
    >
      {/* Beat 1: Train & Generate */}
      <BookSection num="1" title="The One-Word-at-a-Time Game" id="ch7-studio">
        <p className="book-prose">
          Even giant chatbots write using one simple <TermTip id="autoregressive">autoregressive</TermTip>{' '}
          loop: read the words so far, calculate the probability of every possible next word, roll
          a weighted die to pick one, add it to the sentence, and repeat!
        </p>
        <p className="book-prose">
          <strong>Honest peek under the hood:</strong> To train in 1 millisecond right in your
          browser, this Mini-LLM counts 2- and 3-word patterns. Frontier LLMs use the{' '}
          <strong>Self-Attention</strong> network from Chapter 6 to produce these exact same
          next-word probability bars!
        </p>

        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Pick a Story Library */}
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
              1. Pick what your Mini-LLM reads ({modelStats.vocabSize} words learned):
            </div>
            <div className="corpus-grid" role="group" aria-label="Starter training stories">
              {STARTER_CORPORA_LIST.map((corpus) => (
                <button
                  key={corpus.id}
                  type="button"
                  className={`corpus-card ${selectedCorpusId === corpus.id ? 'is-active' : ''}`}
                  onClick={() => selectCorpus(corpus)}
                >
                  <span className="corpus-card-title">
                    <span>{corpus.emoji}</span>
                    <span>{corpus.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="studio-grid">
            {/* Left: Prompt + Generated Story + Buttons */}
            <div className="studio-left">
              <div className="prompt-chips">
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  2. Starter:
                </span>
                {starterChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`prompt-chip ${prompt === chip ? 'is-active' : ''}`}
                    onClick={() => {
                      stopAuto()
                      playClick()
                      setPrompt(chip)
                      setGeneratedTokens([])
                      setLastSampledToken(null)
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="story-output-box" aria-live="polite">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Live Generated Story
                  </span>
                  <span className="badge badge-subtle">+{generatedTokens.length} words</span>
                </div>
                <div className="story-tokens-flow">
                  {promptTokens.map((tok, i) => (
                    <span key={`p-${i}`} className="story-token-prompt">{tok}</span>
                  ))}
                  {generatedTokens.map((tok, i) => (
                    <span key={`g-${i}`} className={`story-token-gen ${i === generatedTokens.length - 1 ? 'is-latest' : ''}`}>
                      {tok}
                    </span>
                  ))}
                </div>
                {generatedTokens.length > 0 && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: 8 }}>
                    {fullStoryText}
                  </div>
                )}
              </div>

              <div className="gen-controls">
                <button
                  type="button"
                  className="btn btn-sky"
                  onClick={() => {
                    stopAuto()
                    appendOne()
                  }}
                >
                  <Dices size={16} />
                  <span>Next Word (+1)</span>
                </button>
                <button
                  type="button"
                  className={`btn ${isAutoGenerating ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={toggleAuto}
                >
                  {isAutoGenerating ? <Square size={15} /> : <Play size={15} />}
                  <span>{isAutoGenerating ? 'Stop' : 'Auto-Write (+10)'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    stopAuto()
                    playClick()
                    setGeneratedTokens([])
                    setLastSampledToken(null)
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Right: Temperature Dial + Clickable Next-Word Odds */}
            <div className="studio-right">
              <div className="dials-card">
                <div className="dial-row">
                  <div className="dial-header">
                    <span>
                      <TermTip id="temperature">Temperature</TermTip>:{' '}
                      <strong className="font-mono">{temperature.toFixed(2)}</strong>
                    </span>
                    <span
                      className="dial-mood-badge"
                      style={{ background: tempMood.bg, color: tempMood.color, border: `1px solid ${tempMood.border}` }}
                    >
                      {tempMood.label}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.8"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="dial-slider"
                    aria-label="Temperature"
                  />
                  <div className="dial-scale">
                    <span>0.1 Robot 🤖</span>
                    <span>0.8 Storyteller ✨</span>
                    <span>1.8 Chaos 🎲</span>
                  </div>
                </div>
              </div>

              <div className="prob-chart-card">
                <h3 style={{ fontSize: '0.98rem', marginBottom: 4 }}>
                  Next-Word Odds after &ldquo;{contextPreview || 'start'}&rdquo;
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Slide Temperature to watch the bars flatten or sharpen — or click any bar to pick that word!
                </p>

                <div className="prob-list" role="list">
                  {distribution.map((item) => {
                    const pct = item.probability * 100
                    return (
                      <button
                        key={item.token}
                        type="button"
                        role="listitem"
                        className={`prob-row ${lastSampledToken === item.token ? 'is-sampled' : ''}`}
                        onClick={() => {
                          stopAuto()
                          appendOne(item.token)
                        }}
                      >
                        <div className="prob-token-col">
                          <span className="prob-token-word">{item.token}</span>
                        </div>
                        <div className="prob-bar-track" aria-hidden="true">
                          <div className="prob-bar-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <span className="prob-pct">{pct.toFixed(1)}%</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <MathDrawer title="Peek at the Math: Temperature-Scaled Softmax">
            <p>
              Dividing raw scores by Temperature <code>T</code> before Softmax sharpens the top choice when{' '}
              <code>T &lt; 1</code> and flattens probabilities toward random guessing when <code>T &gt; 1</code>:
            </p>
            <div className="formula-box">
              P(wᵢ) = exp(log(scoreᵢ) / T) / Σⱼ exp(log(scoreⱼ) / T)
            </div>
          </MathDrawer>
        </div>
      </BookSection>

      {/* Optional Bonus: Custom Training Text & Top-K */}
      <BonusDrawer
        title="Bonus: Train on Your Own Story & Tune Top-K"
        subtitle="Paste your own text or limit the candidate hat size"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            className="corpus-textarea"
            value={trainingText}
            onChange={(e) => setTrainingText(e.target.value)}
            placeholder="Write a few sentences here and click Train Mini-LLM..."
            aria-label="Custom training story"
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" className={`btn btn-sm ${justTrained ? 'btn-success' : 'btn-sky'}`} onClick={trainCustom}>
              <Sparkles size={15} />
              <span>{justTrained ? 'Trained on Your Text!' : 'Train Mini-LLM'}</span>
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 700 }}>
              <span><TermTip id="top-k">Top-K</TermTip> Hat Size: {topK}</span>
              <input type="range" min="2" max="10" step="1" value={topK} onChange={(e) => setTopK(Number(e.target.value))} />
            </label>
          </div>
        </div>
      </BonusDrawer>

      {/* Beat 2: How Real LLMs Scale This Up */}
      <BookSection num="2" title="How Giant Chatbots Scale This Up" id="ch7-scale">
        <p className="book-prose">
          Your Mini-LLM learned from ~100 words in milliseconds. Frontier AI assistants like Gemini,
          ChatGPT, and Claude use the exact same next-token prediction game — scaled up in 3 steps:
        </p>

        <div className="scale-grid">
          <div className="scale-card">
            <span className="scale-step-pill">1 · Pretraining</span>
            <h3>Read Billions of Pages</h3>
            <p>
              A massive Transformer practices next-token prediction on trillions of words from
              books, websites, and code.
            </p>
          </div>
          <div className="scale-card">
            <span className="scale-step-pill">2 · Fine-Tuning</span>
            <h3>Practice Helpful Chats</h3>
            <p>
              Instead of rambling like a storyteller, it trains on curated question-and-answer
              examples so it follows instructions.
            </p>
          </div>
          <div className="scale-card">
            <span className="scale-step-pill">3 · <TermTip id="rlhf">RLHF</TermTip></span>
            <h3>Learn Good Manners</h3>
            <p>
              Humans rate which answers are clearest, most honest, and safest — teaching the model
              to be a helpful partner.
            </p>
          </div>
        </div>
      </BookSection>
    </BookChapter>
  )
}
