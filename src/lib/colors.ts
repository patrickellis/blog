export const HOME_COLOR = '#f59e0b'
export const TARGET_COLOR = '#22d3ee'

type RGB = [number, number, number]
type Lab = [number, number, number]

const toLinear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)))

/** Interpolating in OKLab keeps ramps perceptually even and avoids the muddy greys of sRGB blends. */
function oklab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16)))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

function srgb([L, A, B]: Lab): RGB {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(fromLinear) as RGB
}

function ramp(stops: [number, string][]) {
  const labs = stops.map(([t, hex]) => [t, oklab(hex)] as const)
  return (t: number): RGB => {
    const i = Math.max(1, labs.findIndex(([at]) => at >= t))
    const [t0, a] = labs[i - 1]
    const [t1, b] = labs[i]
    const k = (t - t0) / (t1 - t0)
    return srgb(a.map((v, j) => v + (b[j] - v) * k) as Lab)
  }
}

const rgba = ([r, g, b]: RGB, a = 1) => `rgba(${r},${g},${b},${a})`
const clamp = (t: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, t))

// Dark neutral centre, deep saturated mid-tones, vivid bright extremes: on the dark globe the biggest
// differences are also the most luminous. Steers clear of amber/cyan, which mark home and comparison targets.
const BAD = '#ff3355'
const GOOD = '#2ee88a'
const DIVERGING = ramp([
  [-1, BAD],
  [-0.5, '#c81e4a'],
  [0, '#7c8798'],
  [0.5, '#1f9d57'],
  [1, GOOD],
])

/** t ∈ [-1, 1]: negative = worse (red), positive = better (green). Slightly eased so modest gaps still read. */
export function diverging(t: number, alpha = 0.9) {
  const v = clamp(t)
  return rgba(DIVERGING(Math.sign(v) * Math.abs(v) ** 0.8), alpha)
}

/** t ∈ [0, 1] on the same diverging ramp: low = good (green) → neutral midpoint → high = bad (red). */
export function sequential(t: number, alpha = 0.9) {
  return diverging(1 - 2 * clamp(t, 0, 1), alpha)
}

const gradient = (fn: (t: number) => string, from: number) =>
  `linear-gradient(90deg, ${Array.from({ length: 9 }, (_, i) => fn(from + ((1 - from) * i) / 8)).join(', ')})`
export const DIVERGING_GRADIENT = gradient((t) => diverging(t, 1), -1)
export const SEQUENTIAL_GRADIENT = gradient((t) => sequential(t, 1), 0)
