import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { DESTINATIONS, REGIONS, subdivisionLabel } from '../data/countries'
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
  /** Receives a destination id (ISO2, or e.g. 'CA-ON' for a province). */
  onSelect: (id: string) => void
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
  const selected = DESTINATIONS.find((d) => d.id === value)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return DESTINATIONS.filter((d) => !exclude.includes(d.id))
      .filter((d) => !q || d.label.toLowerCase().includes(q) || d.id.toLowerCase() === q || d.iso2.toLowerCase() === q || d.cities.some((city) => city.name.toLowerCase().includes(q)))
      .sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.countryName.localeCompare(b.countryName) || a.name.localeCompare(b.name))
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

  const choose = (id: string) => {
    onSelect(id)
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
        title={trigger ? undefined : selected?.label}
        className={trigger ? undefined : 'field flex min-w-0 items-center gap-2 text-left'}
      >
        {trigger ?? (
          <>
            {selected ? <Flag iso={selected.iso2} className="shrink-0 text-lg" /> : null}
            <span className="min-w-0 flex-1 truncate">{selected?.label ?? 'Select a country'}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
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
              aria-activedescendant={options[active] ? `${listId}-${options[active].id}` : undefined}
              placeholder="Search country, state, province or city…"
              className="w-full bg-transparent py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, options.length - 1)))
                else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
                else if (e.key === 'Enter' && options[active]) (e.preventDefault(), choose(options[active].id))
                else if (e.key === 'Escape') setOpen(false)
              }}
            />
          </div>
          <ul ref={list} id={listId} role="listbox" aria-label={label} className="scrollbar-thin max-h-72 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">No matching destinations</li>}
            {options.map((c, i) => (
              <li key={c.id}>
                {(i === 0 || options[i - 1].region !== c.region) && <div className="label px-3 pt-2 pb-1 text-[10px]">{c.region}</div>}
                {c.subdivision && (i === 0 || options[i - 1].iso2 !== c.iso2) && (
                  <div className="flex items-center gap-2 px-3 pt-1.5 pb-0.5 text-xs text-slate-400" role="presentation">
                    <Flag iso={c.iso2} className="text-base" />
                    <span className="flex-1 truncate font-medium text-slate-300">{c.countryName}</span>
                    <span className="text-[10px] text-teal-300/80">by {subdivisionLabel(c).one.toLowerCase()}</span>
                  </div>
                )}
                <div
                  id={`${listId}-${c.id}`}
                  role="option"
                  aria-selected={c.id === value}
                  aria-label={c.label}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c.id)}
                  className={cx('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm', c.subdivision && 'pl-9', i === active ? 'bg-white/10 text-white' : 'text-slate-300')}
                >
                  {!c.subdivision && <Flag iso={c.iso2} className="text-base" />}
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-slate-500">{c.subdivision ? c.cities[0].name : c.currency}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
