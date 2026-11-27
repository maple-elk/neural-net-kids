import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  Home,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { STAGES } from '../utils/pathwayLoader.js'
import { playClick } from '../utils/sound.js'

export default function Layout({ children }) {
  const {
    completedStages,
    currentRoute,
    currentStageId,
    navigate,
    soundEnabled,
    toggleSound,
  } = useLearning()

  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const activeStage = currentStageId
    ? STAGES.find((s) => s.id === currentStageId)
    : null

  const completedCount = completedStages.size
  const totalCount = STAGES.length
  const progressPct = currentStageId
    ? Math.round((currentStageId / totalCount) * 100)
    : Math.round((completedCount / Math.max(totalCount, 1)) * 100)

  const handleSelectRoute = (route) => {
    setMenuOpen(false)
    playClick()
    navigate(route)
  }

  return (
    <div className="app-shell">
      <header className="top-nav book-top-nav">
        <div className="nav-inner">
          <button
            type="button"
            className="brand-btn"
            onClick={() => handleSelectRoute('/')}
            aria-label="BrainSpark Table of Contents"
          >
            <span className="brand-mark" aria-hidden="true">
              <Brain size={20} strokeWidth={2.3} />
            </span>
            <span className="brand-text">
              <span className="brand-title">BrainSpark</span>
              <span className="brand-sub">An Interactive Book on AI</span>
            </span>
          </button>

          <nav className="stage-switcher" aria-label="Book chapters" ref={dropdownRef}>
            <button
              type="button"
              className="book-toc-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <BookOpen size={15} />
              <span>
                {activeStage
                  ? `Ch ${activeStage.id} of ${totalCount} · ${activeStage.title}`
                  : `Table of Contents (${completedCount}/${totalCount})`}
              </span>
              <ChevronDown size={15} />
            </button>

            {menuOpen && (
              <div className="stage-dropdown-menu book-toc-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={`stage-dropdown-item ${currentRoute === '/' ? 'is-active' : ''}`}
                  onClick={() => handleSelectRoute('/')}
                >
                  <span className="stage-dropdown-num" style={{ background: '#4f46e5' }}>
                    <Home size={14} />
                  </span>
                  <span className="stage-dropdown-meta">
                    <div className="stage-dropdown-title">Book Cover &amp; Contents</div>
                    <div className="stage-dropdown-sub">
                      {completedCount} of {totalCount} chapters read
                    </div>
                  </span>
                </button>

                {STAGES.map((stage) => {
                  const isActive = currentStageId === stage.id
                  const isDone = completedStages.has(stage.id)
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      role="menuitem"
                      className={`stage-dropdown-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => handleSelectRoute(stage.route)}
                    >
                      <span
                        className="stage-dropdown-num"
                        style={{ background: stage.color }}
                      >
                        {stage.id}
                      </span>
                      <span className="stage-dropdown-meta">
                        <div className="stage-dropdown-title">{stage.title}</div>
                        <div className="stage-dropdown-sub">{stage.part}</div>
                      </span>
                      {isDone && (
                        <CheckCircle2 size={16} color="#10b981" aria-label="Read" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </nav>

          <div className="nav-controls">
            <button
              type="button"
              className={`sound-toggle-btn ${soundEnabled ? 'is-on' : ''}`}
              onClick={() => {
                const willEnable = !soundEnabled
                toggleSound()
                if (willEnable) playClick()
              }}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              title={soundEnabled ? 'Sound effects ON' : 'Sound effects OFF'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </div>

        {/* Subtle chapter progress bar */}
        <div className="book-nav-progress" aria-hidden="true">
          <div
            className="book-nav-progress-fill"
            style={{
              width: `${progressPct}%`,
              background: activeStage?.color || 'var(--brand-primary)',
            }}
          />
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        BrainSpark — an interactive book running 100% locally in your browser. Start at Chapter 1 and turn each page at your own pace.
      </footer>
    </div>
  )
}
