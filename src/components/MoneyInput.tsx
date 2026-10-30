import { useId, useState, type ReactNode } from 'react'
import { currencySymbol, groupDigits, money } from '../lib/format'
import { Hint } from './ui'

const STEPS = 1000

function niceRound(v: number) {
  if (v <= 0) return 0
  const step = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / step) * step
}

const toPos = (v: number, min: number, max: number) =>
  v <= 0 ? 0 : Math.round((Math.log(Math.min(Math.max(v, min), max) / min) / Math.log(max / min)) * (STEPS - 1)) + 1

const fromPos = (p: number, min: number, max: number) => (p <= 0 ? 0 : niceRound(min * (max / min) ** ((p - 1) / (STEPS - 1))))

export function MoneyInput({
  label,
  value,
  onChange,
  currency,
  hint,
  range,
  suffix = '/ yr',
  icon,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  currency: string
  hint?: ReactNode
  /** Log-scale slider bounds in display currency. */
  range?: [number, number]
  suffix?: string
  icon?: ReactNode
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const symbol = currencySymbol(currency)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
          {icon}
          {label}
          {hint && <Hint>{hint}</Hint>}
        </label>
        {range && value > 0 && <span className="text-xs text-slate-500 tabular-nums">{money(value / 12, currency, { compact: true })} / mo</span>}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">{symbol}</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          className="field pr-12 tabular-nums"
          style={{ paddingLeft: `${Math.max(1.75, symbol.length * 0.55 + 1.1)}rem` }}
          value={draft ?? groupDigits(value)}
          onFocus={(e) => {
            setDraft(value ? String(Math.round(value)) : '')
            requestAnimationFrame(() => e.target.select())
          }}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 12)
            setDraft(digits)
            onChange(digits ? Number(digits) : 0)
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>
      </div>
      {range && (
        <input
          type="range"
          aria-label={`${label} slider`}
          className="mt-3"
          min={0}
          max={STEPS}
          value={toPos(value, range[0], range[1])}
          onChange={(e) => onChange(fromPos(Number(e.target.value), range[0], range[1]))}
        />
      )}
    </div>
  )
}
