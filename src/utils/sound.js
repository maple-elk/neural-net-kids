/**
 * Subtle, zero-dependency Web Audio API sound effects for BrainSpark.
 * All tones are kept gentle (gain <= 0.07) and fail silently in non-audio environments.
 */

let soundEnabled = true
let audioCtx = null

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled)
}

export function isSoundEnabled() {
  return soundEnabled
}

function getAudioContext() {
  if (!soundEnabled || typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null

  try {
    if (!audioCtx) {
      audioCtx = new Ctor()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

function scheduleTone(ctx, { type = 'sine', freqStart, freqEnd = freqStart, startOffset = 0, duration = 0.08, gain = 0.05 }) {
  const safeGain = Math.min(0.07, Math.max(0.001, gain))
  const now = ctx.currentTime + startOffset

  const osc = ctx.createOscillator()
  const amp = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freqStart, now)
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration)
  }

  amp.gain.setValueAtTime(0.0001, now)
  amp.gain.linearRampToValueAtTime(safeGain, now + Math.min(0.012, duration * 0.25))
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  osc.connect(amp)
  amp.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + duration + 0.01)
}

/** Soft short woodblock/pop tap for UI interactions. */
export function playClick() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 540,
      freqEnd: 320,
      duration: 0.042,
      gain: 0.045,
    })
  } catch {
    // No-op
  }
}

/** Warm subtle rising chime when an artificial neuron fires ON. */
export function playNeuronFire() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 440,
      freqEnd: 660,
      duration: 0.12,
      gain: 0.048,
    })
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 880,
      freqEnd: 990,
      startOffset: 0.035,
      duration: 0.11,
      gain: 0.032,
    })
  } catch {
    // No-op
  }
}

/** Soft muted blip for gradient descent and backprop steps. */
export function playStep() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 350,
      freqEnd: 430,
      duration: 0.052,
      gain: 0.042,
    })
  } catch {
    // No-op
  }
}

/** Gentle marimba/bubble pop for LLM token sampling. */
export function playTokenPop() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 460,
      freqEnd: 740,
      duration: 0.068,
      gain: 0.05,
    })
  } catch {
    // No-op
  }
}

/** Soft pleasant two-note ping for character/object recognition. */
export function playRecognize() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 523.25,
      duration: 0.09,
      gain: 0.05,
    })
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 659.25,
      startOffset: 0.065,
      duration: 0.12,
      gain: 0.055,
    })
  } catch {
    // No-op
  }
}

/** Gentle 3-note major arpeggio chord for solved puzzles, missions, and stage completion. */
export function playSuccess() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, idx) => {
      scheduleTone(ctx, {
        type: 'triangle',
        freqStart: freq,
        startOffset: idx * 0.075,
        duration: 0.18,
        gain: 0.055,
      })
    })
  } catch {
    // No-op
  }
}
