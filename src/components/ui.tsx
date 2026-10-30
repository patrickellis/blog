import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx, money, pct } from '../lib/format'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-white/10 bg-ink-900/80 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
            value === o.value ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-cyan-400' : 'bg-white/15')}
      >
        <span className={cx('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </button>
      <span className="text-sm">
        <span className="font-medium text-slate-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{description}</span>}
      </span>
    </label>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-slate-300" aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-xs leading-relaxed font-normal tracking-normal text-slate-300 normal-case opacity-0 shadow-xl transition group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  )
}

export function Delta({ value, currency, pctValue, compact = true, className }: { value: number; currency: string; pctValue?: number; compact?: boolean; className?: string }) {
  const tone = Math.abs(value) < 1 ? 'text-slate-400' : value > 0 ? 'text-emerald-400' : 'text-rose-400'
  return (
    <span className={cx('font-medium tabular-nums', tone, className)}>
      {money(value, currency, { compact, sign: true })}
      {pctValue !== undefined && Number.isFinite(pctValue) && Math.abs(value) >= 1 && <span className="ml-1 opacity-75">({pct(pctValue, 0, true)})</span>}
    </span>
  )
}

export function Flag({ iso, className }: { iso: string; className?: string }) {
  const flag = String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  return (
    <span className={cx('leading-none', className)} aria-hidden>
      {flag}
    </span>
  )
}

export function Stat({ label, value, sub, hint }: { label: ReactNode; value: ReactNode; sub?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label flex items-center gap-1">
        {label}
        {hint && <Hint>{hint}</Hint>}
      </div>
      <div className="mt-1 truncate text-lg font-semibold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
