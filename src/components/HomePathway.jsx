import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  MessageSquare,
  Network,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { PATHWAY_META, STAGES } from '../utils/pathwayLoader.js'
import { playClick } from '../utils/sound.js'

const ICON_MAP = {
  Zap,
  TrendingDown,
  Network,
  Eye,
  Compass,
  Sparkles,
  MessageSquare,
  Clock,
}

function StageIcon({ name, size = 18 }) {
  const Icon = ICON_MAP[name] || Sparkles
  return <Icon size={size} strokeWidth={2.2} />
}

export default function HomePathway() {
  const { completedStages, navigate } = useLearning()

  const completedCount = completedStages.size
  const totalStages = STAGES.length
  const nextStage = STAGES.find((stage) => !completedStages.has(stage.id)) || STAGES[0]

  const openChapter = (route) => {
    playClick()
    navigate(route)
  }

  return (
    <div className="book-cover-page">
      {/* Book Cover Hero */}
      <section className="book-cover-hero" aria-label="Welcome">
        <div className="pathway-hero-eyebrow">
          <BookOpen size={14} />
          <span>Interactive Book · 8 Short Chapters · 100% In-Browser</span>
        </div>

        <h1>
          How Does AI <span className="pathway-hero-accent">Actually Think?</span>
        </h1>

        <p className="book-cover-lead">
          {PATHWAY_META.tagline} Each chapter teaches <strong>one big idea</strong> with a hands-on demo built right into the page — starting from zero.
        </p>

        <div className="book-cover-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openChapter(nextStage.route)}
          >
            <BookOpen size={17} />
            <span>
              {completedCount === 0
                ? 'Start Reading: Chapter 1'
                : completedCount === totalStages
                  ? 'Read Again from Chapter 1'
                  : `Continue Chapter ${nextStage.id}: ${nextStage.title}`}
            </span>
            <ArrowRight size={16} />
          </button>

          {completedCount > 0 && (
            <span className="badge badge-success" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
              <CheckCircle2 size={14} />
              {completedCount} of {totalStages} chapters read
            </span>
          )}
        </div>
      </section>

      {/* Clean Table of Contents */}
      <section className="book-toc-section" aria-label="Table of Contents">
        <div className="book-toc-head">
          <h2>Table of Contents</h2>
          <p>Read straight through like a book — every chapter unlocks the puzzle that leads to the next.</p>
        </div>

        <ol className="book-toc-list">
          {STAGES.map((stage) => {
            const isDone = completedStages.has(stage.id)
            const isNext = nextStage.id === stage.id && completedCount > 0 && completedCount < totalStages

            return (
              <li key={stage.id}>
                <button
                  type="button"
                  className={`book-toc-row ${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}
                  style={{ '--stage-accent': stage.color }}
                  onClick={() => openChapter(stage.route)}
                >
                  <span className="book-toc-num" style={{ background: stage.color }}>
                    <StageIcon name={stage.icon} size={17} />
                    <span>0{stage.id}</span>
                  </span>

                  <span className="book-toc-content">
                    <span className="book-toc-part">{stage.part}</span>
                    <span className="book-toc-title">{stage.title}</span>
                    <span className="book-toc-sub">{stage.subtitle}</span>
                  </span>

                  <span className="book-toc-right">
                    {isDone ? (
                      <span className="badge badge-success">
                        <CheckCircle2 size={13} />
                        Read
                      </span>
                    ) : isNext ? (
                      <span className="badge badge-deep">Up Next</span>
                    ) : null}
                    <ArrowRight size={17} className="book-toc-arrow" />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
