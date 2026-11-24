import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGlossaryEntry } from '../data/glossary.js'
import { playClick } from '../utils/sound.js'

const POPOVER_MAX_W = 290
const VIEWPORT_PAD = 12

export default function TermTip({ id, children, className = '' }) {
  const entry = getGlossaryEntry(id)
  const tooltipId = useId()
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'top', ready: false })

  const isOpen = hovered || pinned

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    const popEl = popoverRef.current
    const popW = popEl ? popEl.offsetWidth : POPOVER_MAX_W
    const popH = popEl ? popEl.offsetHeight : 130

    const centerX = rect.left + rect.width / 2
    const maxLeft = Math.max(VIEWPORT_PAD, window.innerWidth - popW - VIEWPORT_PAD)
    const left = Math.max(VIEWPORT_PAD, Math.min(maxLeft, centerX - popW / 2))

    const spaceAbove = rect.top
    const placement = spaceAbove >= popH + 14 ? 'top' : 'bottom'
    const top =
      placement === 'top'
        ? Math.max(VIEWPORT_PAD, rect.top - popH - 10)
        : Math.min(window.innerHeight - popH - VIEWPORT_PAD, rect.bottom + 10)

    setPos({ top, left, placement, ready: true })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointerDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        popoverRef.current?.contains(e.target)
      ) {
        return
      }
      setPinned(false)
      setHovered(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setHovered(false)
      }
    }
    const handleReposition = () => updatePosition()

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [isOpen, updatePosition])

  if (!entry) {
    return <span className={className}>{children || id}</span>
  }

  const label = children ?? entry.term

  return (
    <span className={`term-tip-wrap ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className={`term-tip-trigger ${pinned ? 'is-pinned' : ''}`}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation()
          playClick()
          setPinned((prev) => !prev)
        }}
      >
        <span className="term-tip-label">{label}</span>
        <span className="term-tip-q" aria-hidden="true">
          ?
        </span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            id={tooltipId}
            role="tooltip"
            className={`term-tip-popover is-${pos.placement}`}
            style={{
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              opacity: pos.ready ? 1 : 0,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="term-tip-head">
              <span className="term-tip-title">
                {entry.emoji && <span aria-hidden="true">{entry.emoji}</span>}
                <span>{entry.term}</span>
              </span>
              {pinned && (
                <button
                  type="button"
                  className="term-tip-close"
                  aria-label={`Close ${entry.term} explanation`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPinned(false)
                    setHovered(false)
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <p className="term-tip-plain">{entry.plain}</p>
            {entry.formula && <div className="term-tip-formula">{entry.formula}</div>}
          </div>,
          document.body,
        )}
    </span>
  )
}
