import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setSoundEnabled as syncSoundEnabled } from '../utils/sound.js'

const COMPLETED_STORAGE_KEY = 'brainspark:completedStages'
const SOUND_STORAGE_KEY = 'brainspark:soundEnabled'
const LEGACY_MODE_STORAGE_KEY = 'brainspark:mode'

const LearningContext = createContext(null)

function parseHashRoute() {
  if (typeof window === 'undefined') return '/'
  const raw = window.location.hash || ''
  const cleaned = raw.replace(/^#/, '')
  if (!cleaned || cleaned === '/') return '/'
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`
}

function loadCompletedStages() {
  try {
    const raw = window.localStorage.getItem(COMPLETED_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 8))
    }
  } catch {
    // Ignore storage errors
  }
  return new Set()
}

function loadInitialSoundEnabled() {
  try {
    const saved = window.localStorage.getItem(SOUND_STORAGE_KEY)
    if (saved === 'false') return false
    if (saved === 'true') return true
  } catch {
    // Ignore storage errors
  }
  return true
}

export function LearningProvider({ children }) {
  const [completedStages, setCompletedStages] = useState(loadCompletedStages)
  const [currentRoute, setCurrentRoute] = useState(parseHashRoute)
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const initial = loadInitialSoundEnabled()
    syncSoundEnabled(initial)
    return initial
  })

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_MODE_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }, [])

  useEffect(() => {
    syncSoundEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(parseHashRoute())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const markStageComplete = useCallback((id) => {
    const stageId = Number(id)
    if (!Number.isInteger(stageId)) return
    setCompletedStages((prev) => {
      if (prev.has(stageId)) return prev
      const next = new Set(prev)
      next.add(stageId)
      try {
        window.localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const unmarkStageComplete = useCallback((id) => {
    const stageId = Number(id)
    setCompletedStages((prev) => {
      if (!prev.has(stageId)) return prev
      const next = new Set(prev)
      next.delete(stageId)
      try {
        window.localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const resetProgress = useCallback(() => {
    setCompletedStages(new Set())
    try {
      window.localStorage.removeItem(COMPLETED_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }, [])

  const setSoundEnabled = useCallback((enabled) => {
    const next = Boolean(enabled)
    setSoundEnabledState(next)
    syncSoundEnabled(next)
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(next))
    } catch {
      // Ignore storage errors
    }
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = !prev
      syncSoundEnabled(next)
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const navigate = useCallback((path) => {
    const normalized = !path || path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`
    const targetHash = `#${normalized}`
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
    setCurrentRoute(normalized)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const currentStageId = useMemo(() => {
    const match = currentRoute.match(/^\/stage\/(\d+)$/)
    if (!match) return null
    const id = Number(match[1])
    return id >= 1 && id <= 8 ? id : null
  }, [currentRoute])

  const value = useMemo(
    () => ({
      completedStages,
      markStageComplete,
      unmarkStageComplete,
      resetProgress,
      currentRoute,
      currentStageId,
      navigate,
      soundEnabled,
      setSoundEnabled,
      toggleSound,
    }),
    [
      completedStages,
      markStageComplete,
      unmarkStageComplete,
      resetProgress,
      currentRoute,
      currentStageId,
      navigate,
      soundEnabled,
      setSoundEnabled,
      toggleSound,
    ],
  )

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>
}

export function useLearning() {
  const ctx = useContext(LearningContext)
  if (!ctx) {
    throw new Error('useLearning must be used inside a LearningProvider')
  }
  return ctx
}
