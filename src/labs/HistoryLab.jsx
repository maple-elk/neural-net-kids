import { useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'
import { HISTORY_ERAS, LLM_HISTORY_MILESTONES } from '../data/history.js'
import { getStageById } from '../data/pathway.js'
import { useLearning } from '../context/LearningContext.jsx'
import { playClick, playSuccess } from '../utils/sound.js'
import TermTip from '../components/TermTip.jsx'
import './HistoryLab.css'

const HISTORY_QUIZ = [
  {
    id: 'q-xor',
    question: 'Which famous 1969 puzzle proved that a single-layer perceptron needed hidden layers to level up?',
    options: [
      'The XOR checkerboard problem',
      'Counting prime numbers',
      'Sorting a deck of cards',
      'Playing tic-tac-toe',
    ],
    correctIndex: 0,
    explanation:
      'Minsky and Papert showed in 1969 that a single straight line cannot separate XOR — motivating multi-layer neural networks!',
  },
  {
    id: 'q-backprop',
    question: 'What 1986 breakthrough let hidden layers learn by passing error signals backward from the output?',
    options: [
      'Tokenization',
      'Backpropagation',
      'Top-K sampling',
      'Image cropping',
    ],
    correctIndex: 1,
    explanation:
      'Backpropagation (popularized by Rumelhart, Hinton, and Williams) computes how much each weight contributed to the mistake so every layer can improve.',
  },
  {
    id: 'q-transformer',
    question: 'What does the "T" in GPT and ChatGPT stand for, named after the landmark 2017 paper?',
    options: [
      'Tokenizer',
      'TensorFlow',
      'Transformer',
      'Time-Machine',
    ],
    correctIndex: 2,
    explanation:
      'The 2017 paper "Attention Is All You Need" introduced the Transformer, letting AI read entire sentences in parallel using Self-Attention!',
  },
  {
    id: 'q-rlhf',
    question: 'What technique helped turn raw next-word predictors into helpful, conversational AI assistants in 2022?',
    options: [
      'Drawing sharper edge filters',
      'RLHF (Learning from Human Feedback)',
      'Removing all hidden layers',
      'Lowering the screen brightness',
    ],
    correctIndex: 1,
    explanation:
      'RLHF (Reinforcement Learning from Human Feedback) uses human ratings to teach a language model to give clear, helpful, and polite answers.',
  },
]

function triggerCelebration(big = false) {
  try {
    confetti({
      particleCount: big ? 95 : 55,
      spread: big ? 80 : 62,
      origin: { y: 0.7 },
    })
  } catch {
    // Ignore confetti errors in non-canvas/test environments
  }
}

export default function HistoryLab() {
  const { isDeepDive, completedStages, markStageComplete, navigate } = useLearning()

  const [selectedEra, setSelectedEra] = useState('all')
  const [highlightedId, setHighlightedId] = useState(null)
  const [expandedDeepIds, setExpandedDeepIds] = useState(() => new Set())
  const [quizAnswers, setQuizAnswers] = useState({})

  const isStageComplete = completedStages.has(7)

  const eraById = useMemo(() => {
    const map = {}
    for (const era of HISTORY_ERAS) {
      map[era.id] = era
    }
    return map
  }, [])

  const visibleMilestones = useMemo(() => {
    if (selectedEra === 'all') return LLM_HISTORY_MILESTONES
    return LLM_HISTORY_MILESTONES.filter((m) => m.eraId === selectedEra)
  }, [selectedEra])

  const activeEraObj = selectedEra === 'all' ? null : eraById[selectedEra]

  const answeredCount = Object.keys(quizAnswers).length
  const quizComplete = answeredCount === HISTORY_QUIZ.length
  const quizScore = useMemo(
    () =>
      HISTORY_QUIZ.reduce(
        (sum, q) => (quizAnswers[q.id] === q.correctIndex ? sum + 1 : sum),
        0,
      ),
    [quizAnswers],
  )

  const handleSelectEra = (eraId) => {
    playClick()
    setSelectedEra(eraId)
  }

  const handleToggleDeepDive = (milestoneId) => {
    playClick()
    setExpandedDeepIds((prev) => {
      const next = new Set(prev)
      if (next.has(milestoneId)) {
        next.delete(milestoneId)
      } else {
        next.add(milestoneId)
      }
      return next
    })
  }

  const handleTimelineJump = (milestone) => {
    playClick()
    if (selectedEra !== 'all' && milestone.eraId !== selectedEra) {
      setSelectedEra('all')
    }
    setHighlightedId(milestone.id)
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`milestone-${milestone.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }

  const handleQuizSelect = (questionId, optionIndex) => {
    if (quizAnswers[questionId] !== undefined) return
    const nextAnswers = { ...quizAnswers, [questionId]: optionIndex }
    setQuizAnswers(nextAnswers)

    const question = HISTORY_QUIZ.find((q) => q.id === questionId)
    const isCorrect = question && optionIndex === question.correctIndex
    const isFinished = Object.keys(nextAnswers).length === HISTORY_QUIZ.length

    if (isFinished) {
      const finalScore = HISTORY_QUIZ.reduce(
        (sum, q) => (nextAnswers[q.id] === q.correctIndex ? sum + 1 : sum),
        0,
      )
      playSuccess()
      triggerCelebration(finalScore === HISTORY_QUIZ.length)
    } else if (isCorrect) {
      playSuccess()
    } else {
      playClick()
    }
  }

  const handleQuizReset = () => {
    playClick()
    setQuizAnswers({})
  }

  const handleMarkComplete = () => {
    markStageComplete(7)
    playSuccess()
    triggerCelebration(true)
  }

  return (
    <div className="lab-page history-lab">
      {/* Stage Header */}
      <header className="lab-header">
        <div className="history-header-meta">
          <div className="history-header-badges">
            <span className="badge history-stage-badge">
              <Clock size={14} /> Stage 7 · Master Capstone
            </span>
            <span className={`badge ${isDeepDive ? 'badge-deep' : 'badge-explorer'}`}>
              {isDeepDive ? 'Deep-Dive History Mode' : 'Explorer Story Mode'}
            </span>
            {isStageComplete && (
              <span className="badge badge-success">
                <CheckCircle2 size={14} /> Completed
              </span>
            )}
          </div>
          <h1 className="history-header-title">The Story of AI &amp; LLMs (1943–2026)</h1>
          <p className="history-header-lead">
            {isDeepDive ? (
              <>
                Trace 80+ years of breakthroughs — from the early{' '}
                <TermTip id="perceptron">perceptron</TermTip> and{' '}
                <TermTip id="backprop">backpropagation</TermTip> to{' '}
                <TermTip id="transformer">Transformers</TermTip>,{' '}
                <TermTip id="rlhf">RLHF</TermTip>, and modern reasoning systems.
              </>
            ) : (
              <>
                Travel through time to see how one tiny{' '}
                <TermTip id="perceptron">perceptron</TermTip> from 1943 grew through{' '}
                <TermTip id="backprop">backpropagation</TermTip>,{' '}
                <TermTip id="transformer">Transformers</TermTip>, and{' '}
                <TermTip id="rlhf">RLHF</TermTip> into today’s smart chatbots!
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={16} /> Back to Pathway
        </button>
      </header>

      {/* Era Filter Pills + Interactive 1943–2026 Visual Timeline */}
      <section className="lab-card history-controls-card" aria-label="Timeline controls">
        <div className="era-filter-row" role="tablist" aria-label="Filter milestones by era">
          <button
            type="button"
            role="tab"
            aria-selected={selectedEra === 'all'}
            className={`era-pill ${selectedEra === 'all' ? 'is-active' : ''}`}
            style={{ '--era-color': '#0f172a' }}
            onClick={() => handleSelectEra('all')}
          >
            <Compass size={15} />
            <span>All Eras</span>
            <span className="era-count">({LLM_HISTORY_MILESTONES.length})</span>
          </button>

          {HISTORY_ERAS.map((era) => {
            const count = LLM_HISTORY_MILESTONES.filter((m) => m.eraId === era.id).length
            const active = selectedEra === era.id
            return (
              <button
                key={era.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`era-pill ${active ? 'is-active' : ''}`}
                style={{ '--era-color': era.color }}
                onClick={() => handleSelectEra(era.id)}
              >
                <span className="era-dot" aria-hidden="true" />
                <span>{era.title}</span>
                <span className="era-count">({count})</span>
              </button>
            )
          })}
        </div>

        {activeEraObj && (
          <div
            className="era-summary-banner"
            style={{ '--era-color': activeEraObj.color }}
          >
            <div>
              <strong>{activeEraObj.title}:</strong> {activeEraObj.summary}
            </div>
          </div>
        )}

        {/* Interactive 1943–2026 Node Strip */}
        <div className="timeline-strip-wrap">
          <div className="timeline-strip" aria-label="Jump to year on timeline">
            {LLM_HISTORY_MILESTONES.map((milestone) => {
              const era = eraById[milestone.eraId]
              const isDimmed = selectedEra !== 'all' && milestone.eraId !== selectedEra
              const isSelected = highlightedId === milestone.id
              return (
                <button
                  key={milestone.id}
                  type="button"
                  className={`timeline-node-btn ${isDimmed ? 'is-dimmed' : ''} ${
                    isSelected ? 'is-selected' : ''
                  }`}
                  style={{ '--era-color': era?.color || '#f97316' }}
                  onClick={() => handleTimelineJump(milestone)}
                  title={`${milestone.year}: ${milestone.title}`}
                >
                  <span className="timeline-node-circle" aria-hidden="true">
                    {milestone.emoji}
                  </span>
                  <span className="timeline-node-year">{milestone.year}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Chronological Milestone Cards */}
      <section className="timeline-feed" aria-label="AI History Milestones">
        {visibleMilestones.map((milestone) => {
          const era = eraById[milestone.eraId]
          const eraColor = era?.color || '#f97316'
          const relatedStage = milestone.relatedStageId
            ? getStageById(milestone.relatedStageId)
            : null
          const showDeepDive = isDeepDive || expandedDeepIds.has(milestone.id)

          return (
            <article
              key={milestone.id}
              id={`milestone-${milestone.id}`}
              className="milestone-row"
              style={{ '--era-color': eraColor }}
            >
              <div className="milestone-marker" aria-hidden="true">
                {milestone.emoji}
              </div>

              <div
                className={`milestone-card ${
                  highlightedId === milestone.id ? 'is-highlighted' : ''
                }`}
              >
                <div className="milestone-top">
                  <div className="milestone-title-group">
                    <div className="milestone-meta-row">
                      <span className="milestone-year-badge">{milestone.year}</span>
                      {era && <span className="milestone-era-tag">{era.title}</span>}
                    </div>
                    <h2 className="milestone-title">
                      <span aria-hidden="true">{milestone.emoji}</span>
                      <span>{milestone.title}</span>
                    </h2>
                    <div className="milestone-people">
                      <Users size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                      {milestone.people}
                    </div>
                  </div>
                </div>

                {/* Breakthrough Callout */}
                <div className="milestone-breakthrough">
                  <Sparkles size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Big Breakthrough:</strong> {milestone.breakthrough}
                  </div>
                </div>

                {/* Kid Story (Explorer Mode) */}
                <div className="callout-kid">
                  <div className="milestone-story-label">
                    <Compass size={13} /> The Story
                  </div>
                  <p>{milestone.kidStory}</p>
                </div>

                {/* Deep-Dive Technical Card (always open in Deep-Dive mode, toggleable in Explorer mode) */}
                {!isDeepDive && (
                  <button
                    type="button"
                    className="milestone-deep-toggle"
                    onClick={() => handleToggleDeepDive(milestone.id)}
                    aria-expanded={showDeepDive}
                  >
                    <FlaskConical size={14} />
                    <span>{showDeepDive ? 'Hide Deep-Dive Details' : 'Peek Under the Hood (Deep-Dive)'}</span>
                    {showDeepDive ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                )}

                {showDeepDive && (
                  <div className="callout-deep">
                    <div className="milestone-story-label">
                      <FlaskConical size={13} /> Technical Deep-Dive
                    </div>
                    <p>{milestone.deepDive}</p>
                  </div>
                )}

                {/* Fun Fact */}
                <div className="milestone-funfact">
                  <Lightbulb size={17} style={{ flexShrink: 0, marginTop: 2, color: '#f59e0b' }} />
                  <div>
                    <strong>Fun Fact:</strong> {milestone.funFact}
                  </div>
                </div>

                {/* Lab Link Footer */}
                {milestone.relatedStageId && (
                  <div className="milestone-footer">
                    <span className="badge badge-subtle">
                      Connected Lab: Stage {milestone.relatedStageId}
                      {relatedStage ? ` · ${relatedStage.title}` : ''}
                    </span>
                    <button
                      type="button"
                      className="milestone-stage-btn"
                      onClick={() => navigate(`/stage/${milestone.relatedStageId}`)}
                    >
                      <span>Try this concept in Stage {milestone.relatedStageId}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </section>

      {/* 4-Question AI History Quick Quiz */}
      <section className="lab-card history-quiz-card" aria-label="AI History Quick Quiz">
        <div className="quiz-header">
          <div>
            <h2>
              <HelpCircle size={22} color="#4f46e5" /> AI History Quick Quiz
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', marginTop: 4 }}>
              Test your time-travel memory across 4 big AI breakthroughs!
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="quiz-score-pill">
              <Award size={16} /> Score: {quizScore} / {HISTORY_QUIZ.length}
            </span>
            {answeredCount > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleQuizReset}>
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>
        </div>

        <div className="quiz-grid">
          {HISTORY_QUIZ.map((q, qIdx) => {
            const picked = quizAnswers[q.id]
            const isAnswered = picked !== undefined
            const isCorrect = picked === q.correctIndex

            return (
              <div key={q.id} className="quiz-question-box">
                <span className="quiz-question-num">Question {qIdx + 1} of {HISTORY_QUIZ.length}</span>
                <p className="quiz-question-text">{q.question}</p>

                <div className="quiz-options">
                  {q.options.map((opt, optIdx) => {
                    let stateClass = ''
                    if (isAnswered) {
                      if (optIdx === q.correctIndex) stateClass = 'is-correct'
                      else if (optIdx === picked) stateClass = 'is-wrong'
                    }

                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`quiz-option-btn ${stateClass}`}
                        disabled={isAnswered}
                        onClick={() => handleQuizSelect(q.id, optIdx)}
                      >
                        <span>{opt}</span>
                        {isAnswered && optIdx === q.correctIndex && (
                          <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0 }} />
                        )}
                        {isAnswered && optIdx === picked && optIdx !== q.correctIndex && (
                          <XCircle size={17} color="#ef4444" style={{ flexShrink: 0 }} />
                        )}
                      </button>
                    )
                  })}
                </div>

                {isAnswered && (
                  <div className={`quiz-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`}>
                    <strong>{isCorrect ? 'Spot on! ' : 'Good try! '}</strong>
                    {q.explanation}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {quizComplete && (
          <div className="quiz-complete-banner">
            <div>
              <h3 style={{ fontSize: '1.15rem', color: '#065f46' }}>
                {quizScore === HISTORY_QUIZ.length
                  ? '🎉 Perfect 4/4! You are an official AI Time Traveler!'
                  : `🌟 Quiz Complete! You scored ${quizScore} out of ${HISTORY_QUIZ.length}!`}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 3 }}>
                Ready to lock in your Stage 7 badge or revisit any interactive lab?
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleQuizReset}>
              <RotateCcw size={15} /> Play Again
            </button>
          </div>
        )}
      </section>

      {/* Footer Navigation */}
      <footer className="lab-footer-nav">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/stage/6')}
        >
          <ArrowLeft size={16} /> Stage 6: Build a Mini-LLM
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className={`btn ${isStageComplete ? 'btn-secondary' : 'btn-success'}`}
            onClick={handleMarkComplete}
          >
            <CheckCircle2 size={17} />
            {isStageComplete ? 'Stage 7 Completed!' : 'Mark Stage 7 Complete'}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/')}
          >
            Back to Learning Pathway <ArrowRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  )
}
