const cache = new Map<string, Intl.NumberFormat>()

function nf(key: string, make: () => Intl.NumberFormat) {
  let f = cache.get(key)
  if (!f) cache.set(key, (f = make()))
  return f
}

export function money(value: number, currency: string, opts: { compact?: boolean; sign?: boolean } = {}) {
  const { compact = false, sign = false } = opts
  const f = nf(`${currency}|${compact}|${sign}`, () =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
      minimumFractionDigits: 0,
      signDisplay: sign ? 'exceptZero' : 'auto',
    }),
  )
  return f.format(Math.round(value))
}

export function pct(value: number, digits = 1, sign = false) {
  if (!Number.isFinite(value)) return '—'
  const f = nf(`pct|${digits}|${sign}`, () =>
    new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: 0, signDisplay: sign ? 'exceptZero' : 'auto' }),
  )
  return f.format(value)
}

export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  )
}

export function groupDigits(n: number) {
  return nf('group', () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })).format(n)
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
