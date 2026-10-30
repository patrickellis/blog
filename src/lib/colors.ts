export const HOME_COLOR = '#f59e0b'
export const TARGET_COLOR = '#22d3ee'

type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB
const rgba = ([r, g, b]: RGB, a = 1) => `rgba(${r},${g},${b},${a})`

const ROSE = hex('#f43f5e')
const SLATE = hex('#64748b')
const EMERALD = hex('#10b981')
const AMBER = hex('#f59e0b')

const clamp = (t: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, t))

/** t ∈ [-1, 1]: negative = worse (rose), positive = better (emerald). */
export function diverging(t: number, alpha = 0.9) {
  const v = clamp(t)
  return rgba(v < 0 ? mix(SLATE, ROSE, -v) : mix(SLATE, EMERALD, v), alpha)
}

/** t ∈ [0, 1]: low = good (emerald) → amber → high = bad (rose). */
export function sequential(t: number, alpha = 0.9) {
  const v = clamp(t, 0, 1)
  return rgba(v < 0.5 ? mix(EMERALD, AMBER, v * 2) : mix(AMBER, ROSE, (v - 0.5) * 2), alpha)
}

export const DIVERGING_GRADIENT = `linear-gradient(90deg, ${diverging(-1, 1)}, ${diverging(0, 1)}, ${diverging(1, 1)})`
export const SEQUENTIAL_GRADIENT = `linear-gradient(90deg, ${sequential(0, 1)}, ${sequential(0.5, 1)}, ${sequential(1, 1)})`
