import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Sparkles,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById, STAGES } from '../utils/pathwayLoader.js'
import { playClick, playSuccess } from '../utils/sound.js'

/**
 * Collapsible inline math / under-the-hood drawer so every reader
 * gets one clear explanation and can optionally peek at the formulas.
 */
export function MathDrawer({ title = 'Peek at the Math', children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`book-drawer book-math-drawer ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="book-drawer-trigger"
        aria-expanded={open}
        onClick={() => {
          playClick()
          setOpen((v) => !v)
        }}
      >
        <span className="book-drawer-label">
          <FlaskConical size={15} />
          <span>{title}</span>
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="book-drawer-body">{children}</div>}
    </div>
  )
}

/**
 * Collapsible bonus/sandbox drawer at the bottom of a chapter
 * for curious readers who want extra knobs without cluttering the story.
 */
export function BonusDrawer({ title = 'Bonus: Free Sandbox', subtitle, children }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={`book-drawer book-bonus-drawer ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="book-drawer-trigger book-bonus-trigger"
        aria-expanded={open}
        onClick={() => {
          playClick()
          setOpen((v) => !v)
        }}
      >
        <span className="book-drawer-label">
          <Sparkles size={16} />
          <span>
            <strong>{title}</strong>
            {subtitle && <span className="book-bonus-sub"> — {subtitle}</span>}
          </span>
        </span>
        <span className="book-drawer-pill">{open ? 'Hide' : 'Open'}</span>
      </button>
      {open && <div className="book-drawer-body book-bonus-body">{children}</div>}
    </section>
  )
}

/**
 * Narrative chapter beat with optional section number and title.
 */
export function BookSection({ num, title, children, id }) {
  return (
    <section className="book-section" aria-labelledby={id}>
      {title && (
        <div className="book-section-head">
          {num && <span className="book-section-num">{num}</span>}
          <h2 id={id}>{title}</h2>
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Shared reading-first Book Chapter wrapper.
 * Handles chapter header, accent color, cliffhanger bridge, completion,
 * and Previous / Next chapter page-turning navigation.
 */
export default function BookChapter({
  chapterId,
  recapFromPrev,
  cliffhangerTitle,
  cliffhangerText,
  children,
}) {
  const { completedStages, markStageComplete, navigate } = useLearning()
  const chapter = getStageById(chapterId)
  const prevChapter = chapterId > 1 ? getStageById(chapterId - 1) : null
  const nextChapter = chapterId < STAGES.length ? getStageById(chapterId + 1) : null
  const isDone = completedStages.has(chapterId)

  const handleTurnPage = () => {
    markStageComplete(chapterId)
    playSuccess()
    if (nextChapter) {
      navigate(nextChapter.route)
    } else {
      navigate('/')
    }
  }

  return (
    <article
      className="book-chapter"
      style={{ '--stage-accent': chapter?.color || '#4f46e5' }}
    >
      {/* Chapter Opening Header */}
      <header className="book-chapter-header">
        <div className="book-chapter-meta">
          <span className="book-chapter-eyebrow">
            <BookOpen size={14} />
            <span>
              Chapter {chapterId} of {STAGES.length}
              {chapter?.part ? ` · ${chapter.part}` : ''}
            </span>
          </span>
          {isDone && (
            <span className="badge badge-success">
              <CheckCircle2 size={13} />
              Read
            </span>
          )}
        </div>

        <h1 className="book-chapter-title">{chapter?.title || `Chapter ${chapterId}`}</h1>
        <p className="book-chapter-subtitle">{chapter?.subtitle}</p>

        {recapFromPrev && (
          <div className="book-recap-bridge">
            <strong>Previously:</strong> {recapFromPrev}
          </div>
        )}
      </header>

      {/* Linear Story + Embedded Demos */}
      <div className="book-chapter-body">{children}</div>

      {/* Cliffhanger & Turn-the-Page Footer */}
      <footer className="book-chapter-footer">
        {(cliffhangerTitle || cliffhangerText) && (
          <div className="book-cliffhanger-card">
            <div className="book-cliffhanger-eyebrow">
              {nextChapter ? 'Wait — what happens next?' : 'You made it!'}
            </div>
            {cliffhangerTitle && <h3>{cliffhangerTitle}</h3>}
            {cliffhangerText && <p>{cliffhangerText}</p>}
          </div>
        )}

        <nav className="book-page-nav" aria-label="Chapter navigation">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              playClick()
              navigate(prevChapter ? prevChapter.route : '/')
            }}
          >
            <ArrowLeft size={16} />
            <span>
              {prevChapter ? `Ch ${prevChapter.id}: ${prevChapter.title}` : 'Table of Contents'}
            </span>
          </button>

          <button
            type="button"
            className="btn btn-primary book-next-btn"
            onClick={handleTurnPage}
          >
            <span>
              {nextChapter
                ? `Next: Ch ${nextChapter.id} — ${nextChapter.title}`
                : 'Finish Book & Return to Cover'}
            </span>
            <ArrowRight size={16} />
          </button>
        </nav>
      </footer>
    </article>
  )
}
