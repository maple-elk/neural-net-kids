import { useEffect, useRef, useState } from 'react'
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  Compass,
  FlaskConical,
  Home,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { STAGES } from '../utils/pathwayLoader.js'
import { playClick } from '../utils/sound.js'

export default function Layout({ children }) {
  const {
    mode,
    setMode,
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

  const handleSelectRoute = (route) => {
    setMenuOpen(false)
    navigate(route)
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="nav-inner">
          <button
            type="button"
            className="brand-btn"
            onClick={() => handleSelectRoute('/')}
            aria-label="BrainSpark Home"
          >
            <span className="brand-mark" aria-hidden="true">
              <Brain size={21} strokeWidth={2.3} />
            </span>
            <span className="brand-text">
              <span className="brand-title">BrainSpark</span>
              <span className="brand-sub">Neural Nets &amp; LLMs Lab</span>
            </span>
          </button>

          <nav className="stage-switcher" aria-label="Learning stages" ref={dropdownRef}>
            <div className="stage-pills-desktop" role="group" aria-label="Quick stage switcher">
              <button
                type="button"
                className={`stage-pill ${currentRoute === '/' ? 'is-active' : ''}`}
                style={{ '--stage-accent': '#4f46e5' }}
                onClick={() => handleSelectRoute('/')}
                title="Pathway Home"
                aria-label="Pathway Home"
              >
                <Home size={15} />
              </button>
              {STAGES.map((stage) => {
                const isActive = currentStageId === stage.id
                const isDone = completedStages.has(stage.id)
                return (
                  <button
                    key={stage.id}
                    type="button"
                    className={`stage-pill ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                    style={{ '--stage-accent': stage.color }}
                    onClick={() => handleSelectRoute(stage.route)}
                    title={`Stage ${stage.id}: ${stage.title}${isDone ? ' (Completed)' : ''}`}
                    aria-label={`Stage ${stage.id}: ${stage.title}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {stage.id}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="stage-dropdown-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span>{activeStage ? `Stage ${activeStage.id}` : 'All Stages'}</span>
              <ChevronDown size={15} />
            </button>

            {menuOpen && (
              <div className="stage-dropdown-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={`stage-dropdown-item ${currentRoute === '/' ? 'is-active' : ''}`}
                  onClick={() => handleSelectRoute('/')}
                >
                  <span
                    className="stage-dropdown-num"
                    style={{ background: '#4f46e5' }}
                  >
                    <Home size={14} />
                  </span>
                  <span className="stage-dropdown-meta">
                    <div className="stage-dropdown-title">Pathway Map</div>
                    <div className="stage-dropdown-sub">Overview of all 7 labs</div>
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
                        <div className="stage-dropdown-sub">
                          {stage.level} · {stage.ageBadge}
                        </div>
                      </span>
                      {isDone && (
                        <CheckCircle2 size={17} color="#10b981" aria-label="Completed" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </nav>

          <div className="nav-controls">
            <div className="mode-toggle" role="group" aria-label="Explanation depth">
              <button
                type="button"
                className={`mode-toggle-btn ${mode === 'explorer' ? 'is-active-explorer' : ''}`}
                onClick={() => setMode('explorer')}
                aria-pressed={mode === 'explorer'}
                title="Explorer mode: playful metaphors & hands-on intuition (Ages 8–12)"
              >
                <Compass size={14} />
                <span>Explorer</span>
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${mode === 'deep-dive' ? 'is-active-deep' : ''}`}
                onClick={() => setMode('deep-dive')}
                aria-pressed={mode === 'deep-dive'}
                title="Deep-Dive mode: formulas, weights, gradients & technical details"
              >
                <FlaskConical size={14} />
                <span>Deep-Dive</span>
              </button>
            </div>

            <button
              type="button"
              className={`sound-toggle-btn ${soundEnabled ? 'is-on' : ''}`}
              onClick={() => {
                const willEnable = !soundEnabled
                toggleSound()
                if (willEnable) {
                  playClick()
                }
              }}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              title={soundEnabled ? 'Sound effects ON (click to mute)' : 'Sound effects OFF (click to enable)'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <div
              className="progress-pill"
              title={`${completedCount} of ${totalCount} stages completed`}
              aria-label={`Progress: ${completedCount} of ${totalCount} stages completed`}
            >
              <Trophy size={14} />
              <span>
                {completedCount}/{totalCount}
              </span>
              <span className="progress-pill-label">done</span>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        BrainSpark runs 100% locally in your browser — tweak weights, train real mini networks, and explore how AI learns.
      </footer>
    </div>
  )
}
