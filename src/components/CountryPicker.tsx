import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { COUNTRIES, REGIONS } from '../data/countries'
import { cx } from '../lib/format'
import { Flag } from './ui'

export function CountryPicker({
  value,
  onSelect,
  exclude = [],
  trigger,
  label,
  align = 'left',
}: {
  value?: string
  onSelect: (iso: string) => void
  exclude?: string[]
  /** Custom trigger content; defaults to a field showing the selected country. */
  trigger?: ReactNode
  label: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = COUNTRIES.find((c) => c.iso2 === value)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return COUNTRIES.filter((c) => !exclude.includes(c.iso2)).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q || c.cities.some((city) => city.name.toLowerCase().includes(q)),
    ).sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.name.localeCompare(b.name))
  }, [query, exclude])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (iso: string) => {
    onSelect(iso)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={trigger ? undefined : 'field flex items-center gap-2 text-left'}
      >
        {trigger ?? (
          <>
            {selected ? <Flag iso={selected.iso2} className="text-lg" /> : null}
            <span className="flex-1 truncate">{selected?.name ?? 'Select a country'}</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </>
        )}
      </button>
      {open && (
        <div
          className={cx(
            'absolute z-40 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 shadow-2xl shadow-black/50 backdrop-blur-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              autoFocus
              role="combobox"
              aria-controls={listId}
              aria-expanded
              aria-activedescendant={options[active] ? `${listId}-${options[active].iso2}` : undefined}
              placeholder="Search country or city…"
              className="w-full bg-transparent py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, options.length - 1)))
                else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
                else if (e.key === 'Enter' && options[active]) (e.preventDefault(), choose(options[active].iso2))
                else if (e.key === 'Escape') setOpen(false)
              }}
            />
          </div>
          <ul ref={list} id={listId} role="listbox" aria-label={label} className="scrollbar-thin max-h-72 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">No matching destinations</li>}
            {options.map((c, i) => (
              <li key={c.iso2}>
                {(i === 0 || options[i - 1].region !== c.region) && <div className="label px-3 pt-2 pb-1 text-[10px]">{c.region}</div>}
                <div
                  id={`${listId}-${c.iso2}`}
                  role="option"
                  aria-selected={c.iso2 === value}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c.iso2)}
                  className={cx('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm', i === active ? 'bg-white/10 text-white' : 'text-slate-300')}
                >
                  <Flag iso={c.iso2} className="text-base" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-slate-500">{c.currency}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
