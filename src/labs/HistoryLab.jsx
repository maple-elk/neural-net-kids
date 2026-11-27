import { useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { ArrowRight, Award, CheckCircle2, Lightbulb, RotateCcw, Sparkles, Users, XCircle } from 'lucide-react'
import { HISTORY_ERAS, LLM_HISTORY_MILESTONES } from '../data/history.js'
import { getStageById } from '../data/pathway.js'
import { useLearning } from '../context/LearningContext.jsx'
import { playClick, playSuccess } from '../utils/sound.js'
import BookChapter, { BookSection, MathDrawer } from '../components/BookChapter.jsx'
import TermTip from '../components/TermTip.jsx'
import './HistoryLab.css'

const AI_FAMILIES = [
  {
    id: 'mlp',
    emoji: '🕸️',
    name: 'Feedforward / MLP',
    color: '#6366f1',
    superpower: 'Finds curved patterns in tables, numbers, and 2D coordinates (Chapter 3).',
    stageId: 3,
  },
  {
    id: 'cnn',
    emoji: '🔍',
    name: 'Convolutional (CNN)',
    color: '#10b981',
    superpower: 'Slides tiny 3×3 lenses over pixel grids to spot edges and objects (Chapter 4).',
    stageId: 4,
  },
  {
    id: 'rnn',
    emoji: '🔁',
    name: 'Recurrent (RNN)',
    color: '#f59e0b',
    superpower: 'Loops its hidden memory forward one step at a time for sensor streams and audio.',
    stageId: null,
  },
  {
    id: 'transformer',
    emoji: '✨',
    name: 'Transformer',
    color: '#ec4899',
    superpower: 'Uses parallel Self-Attention spotlights to read and write whole pages (Chapters 6 & 7).',
    stageId: 6,
  },
]

const BRAIN_MATCH_QUIZ = [
  {
    id: 'b1',
    emoji: '🛑',
    prompt: 'Spot stop signs and bicycles in a live self-driving car camera.',
    answer: 'cnn',
    why: 'CNNs slide pattern-spotting filters across 2D image grids!',
  },
  {
    id: 'b2',
    emoji: '📖',
    prompt: 'Write a 5-page adventure story while remembering characters from page 1.',
    answer: 'transformer',
    why: 'Transformers use Self-Attention spotlights to link words across long text!',
  },
  {
    id: 'b3',
    emoji: '🏡',
    prompt: 'Estimate a house price from bedrooms, square feet, and neighborhood score.',
    answer: 'mlp',
    why: 'A Feedforward MLP combines fixed numeric clues through hidden layers!',
  },
]

const HISTORY_QUIZ = [
  {
    id: 'q-xor',
    question: 'Which 1969 puzzle proved that one straight line wasn’t enough, motivating hidden layers?',
    options: ['The XOR checkerboard problem', 'Counting prime numbers', 'Sorting cards', 'Tic-tac-toe'],
    correctIndex: 0,
    explanation: 'Minsky and Papert proved one perceptron cannot separate XOR — unlocking multi-layer networks!',
  },
  {
    id: 'q-backprop',
    question: 'What 1986 breakthrough let hidden layers learn by passing error notes backward?',
    options: ['Tokenization', 'Backpropagation', 'Top-K sampling', 'Image cropping'],
    correctIndex: 1,
    explanation: 'Backpropagation computes how much each hidden weight contributed to the mistake so every layer improves.',
  },
  {
    id: 'q-transformer',
    question: 'What does the "T" in GPT and ChatGPT stand for, from the 2017 paper?',
    options: ['Tokenizer', 'TensorFlow', 'Transformer', 'Time-Machine'],
    correctIndex: 2,
    explanation: '"Attention Is All You Need" (2017) introduced the Transformer, letting AI read whole sentences in parallel!',
  },
  {
    id: 'q-rlhf',
    question: 'What technique helped turn raw next-word predictors into helpful chat assistants in 2022?',
    options: ['Sharper edge filters', 'RLHF (Human Feedback)', 'Removing hidden layers', 'Lowering screen brightness'],
    correctIndex: 1,
    explanation: 'RLHF uses human ratings to align language models to be helpful, clear, and polite.',
  },
]

export default function HistoryLab() {
  const { navigate } = useLearning()
  const [brainAnswers, setBrainAnswers] = useState({})
  const [quizAnswers, setQuizAnswers] = useState({})
  const celebratedRef = useRef(false)

  const eraById = useMemo(() => {
    const map = {}
    for (const era of HISTORY_ERAS) map[era.id] = era
    return map
  }, [])

  const quizScore = useMemo(
    () => HISTORY_QUIZ.reduce((sum, q) => (quizAnswers[q.id] === q.correctIndex ? sum + 1 : sum), 0),
    [quizAnswers],
  )
  const quizComplete = Object.keys(quizAnswers).length === HISTORY_QUIZ.length

  const handleQuizSelect = (qId, idx) => {
    if (quizAnswers[qId] !== undefined) return
    const next = { ...quizAnswers, [qId]: idx }
    setQuizAnswers(next)
    const q = HISTORY_QUIZ.find((item) => item.id === qId)
    if (q && idx === q.correctIndex) playSuccess()
    else playClick()

    if (Object.keys(next).length === HISTORY_QUIZ.length && !celebratedRef.current) {
      celebratedRef.current = true
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } })
      } catch {
        // Ignore in headless environments
      }
    }
  }

  return (
    <BookChapter
      chapterId={8}
      recapFromPrev="You’ve built and played with every core piece of modern AI — neurons, gradient descent, hidden layers, vision filters, meaning maps, self-attention, and next-word generation."
      cliffhangerTitle="🎉 Congratulations — You’ve Read the Whole Book!"
      cliffhangerText="You now understand the real building blocks behind modern AI — from a single weighted switch to Large Language Models. Return to the Table of Contents anytime to replay a demo!"
    >
      {/* Beat 1: The 4 Families of AI Brains */}
      <BookSection num="1" title="The 4 Families of AI Brains" id="ch8-zoo">
        <p className="book-prose">
          Not all neural networks are wired the same way! Every demo you tried belongs to one of
          four famous architecture families:
        </p>

        <div className="lab-grid-2">
          {AI_FAMILIES.map((fam) => (
            <div
              key={fam.id}
              className="lab-card"
              style={{
                borderLeft: `4px solid ${fam.color}`,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: '1.04rem' }}>
                  {fam.emoji} <TermTip id={fam.id}>{fam.name}</TermTip>
                </strong>
                {fam.stageId && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      playClick()
                      navigate(`/stage/${fam.stageId}`)
                    }}
                  >
                    Ch {fam.stageId} →
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{fam.superpower}</p>
            </div>
          ))}
        </div>

        {/* Mini Match Game */}
        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: '1.1rem' }}>🎮 Quick Match: Pick the Right Brain!</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BRAIN_MATCH_QUIZ.map((q) => {
              const picked = brainAnswers[q.id]
              const isRight = picked === q.answer
              return (
                <div
                  key={q.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: isRight ? '#ecfdf5' : 'var(--bg-subtle)',
                    border: `1px solid ${isRight ? '#6ee7b7' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <strong style={{ fontSize: '0.92rem' }}>
                    {q.emoji} {q.prompt}
                  </strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {AI_FAMILIES.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`btn btn-sm ${picked === opt.id ? (isRight ? 'btn-success' : 'btn-primary') : 'btn-secondary'}`}
                        onClick={() => {
                          setBrainAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                          if (opt.id === q.answer) playSuccess()
                          else playClick()
                        }}
                      >
                        {opt.emoji} {opt.name}
                      </button>
                    ))}
                  </div>
                  {picked && (
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isRight ? '#065f46' : '#b91c1c' }}>
                      {isRight ? `✅ Spot on! ${q.why}` : 'Not quite — think about what kind of input this job uses and try again!'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </BookSection>

      {/* Beat 2: The 80-Year Timeline */}
      <BookSection num="2" title="80 Years of Breakthroughs (1943–Today)" id="ch8-timeline">
        <p className="book-prose">
          Modern AI didn’t appear overnight — it took over 80 years of breakthroughs, chilly AI
          winters, and eureka moments. Every milestone below connects right back to a chapter you
          just read:
        </p>

        <div className="timeline-feed" aria-label="AI History Milestones">
          {LLM_HISTORY_MILESTONES.map((milestone) => {
            const era = eraById[milestone.eraId]
            const eraColor = era?.color || '#f97316'
            const relatedChapter = milestone.relatedStageId ? getStageById(milestone.relatedStageId) : null

            return (
              <article
                key={milestone.id}
                className="milestone-row"
                style={{ '--era-color': eraColor }}
              >
                <div className="milestone-marker" aria-hidden="true">{milestone.emoji}</div>
                <div className="milestone-card">
                  <div className="milestone-meta-row">
                    <span className="milestone-year-badge">{milestone.year}</span>
                    {era && <span className="milestone-era-tag">{era.title}</span>}
                  </div>
                  <h3 className="milestone-title" style={{ fontSize: '1.16rem' }}>
                    {milestone.title}
                  </h3>
                  <div className="milestone-people">
                    <Users size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                    {milestone.people}
                  </div>

                  <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {milestone.kidStory}
                  </p>

                  <div className="milestone-funfact">
                    <Lightbulb size={16} style={{ flexShrink: 0, marginTop: 2, color: '#f59e0b' }} />
                    <div><strong>Fun Fact:</strong> {milestone.funFact}</div>
                  </div>

                  <MathDrawer title="Technical Note">
                    <p>{milestone.deepDive}</p>
                  </MathDrawer>

                  {relatedChapter && (
                    <div className="milestone-footer">
                      <span className="badge badge-subtle">
                        Chapter {relatedChapter.id} · {relatedChapter.title}
                      </span>
                      <button
                        type="button"
                        className="milestone-stage-btn"
                        onClick={() => {
                          playClick()
                          navigate(relatedChapter.route)
                        }}
                      >
                        <span>Revisit Ch {relatedChapter.id}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </BookSection>

      {/* Beat 3: Final Recap Quiz */}
      <BookSection num="3" title="Final Check: AI Time-Traveler Quiz" id="ch8-quiz">
        <div className="lab-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span className="quiz-score-pill">
              <Award size={16} /> Score: {quizScore} / {HISTORY_QUIZ.length}
            </span>
            {Object.keys(quizAnswers).length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  playClick()
                  setQuizAnswers({})
                  celebratedRef.current = false
                }}
              >
                <RotateCcw size={14} /> Reset Quiz
              </button>
            )}
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
                          {isAnswered && optIdx === q.correctIndex && <CheckCircle2 size={16} color="#10b981" />}
                          {isAnswered && optIdx === picked && optIdx !== q.correctIndex && <XCircle size={16} color="#ef4444" />}
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
            <div className="book-takeaway" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={18} />
              <strong>
                {quizScore === HISTORY_QUIZ.length
                  ? 'Perfect 4/4! You are an official Neural Net & LLM Explorer!'
                  : `Nice work! You scored ${quizScore} out of ${HISTORY_QUIZ.length}!`}
              </strong>
            </div>
          )}
        </div>
      </BookSection>
    </BookChapter>
  )
}
