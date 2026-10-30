import type { Country, Destination, SubdivisionKind } from '../../types'
import { americas } from './americas'
import { asiaPacific } from './asia-pacific'
import { europe } from './europe'
import { middleEastAfrica } from './middle-east-africa'

export const COUNTRIES: Country[] = [...europe, ...middleEastAfrica, ...asiaPacific, ...americas].sort((a, b) => a.name.localeCompare(b.name))

/** Splits countries with regional tax systems into one destination per subdivision. */
function expand(c: Country): Destination[] {
  if (!c.subdivisions?.length) return [{ ...c, id: c.iso2, label: c.name, countryName: c.name }]
  return c.subdivisions.map((s) => ({
    ...c,
    id: `${c.iso2}-${s.code}`,
    name: s.name,
    label: `${s.name}, ${c.name}`,
    countryName: c.name,
    lat: s.lat,
    lng: s.lng,
    micro: s.micro,
    subdivision: s,
    tax: s.tax ? { ...c.tax, ...s.tax } : c.tax,
    regimes: s.excludeRegimes ? c.regimes?.filter((r) => !s.excludeRegimes!.includes(r.id)) : c.regimes,
    cities: s.cities.map((city) => ({
      ...city,
      local: s.local || city.local ? [...(s.local ?? []), ...(city.local ?? [])] : undefined,
      wealth: city.wealth !== undefined ? city.wealth : s.wealth,
    })),
    headline: { ...c.headline, ...s.headline },
    notes: [...(s.notes ?? []), ...c.notes],
    utc: s.utc ?? c.utc,
  }))
}

export const DESTINATIONS: Destination[] = COUNTRIES.flatMap(expand)

export const BY_ID = new Map(DESTINATIONS.map((d) => [d.id, d]))
export const COUNTRY_BY_ISO = new Map(COUNTRIES.map((c) => [c.iso2, c]))
export const BY_NUM = new Map(COUNTRIES.map((c) => [c.num, c]))

/** Destinations sharing a country (all provinces of Canada, etc.). */
export const siblingsOf = (d: Destination) => DESTINATIONS.filter((x) => x.iso2 === d.iso2)

/** Accepts a destination id or a bare country code (old links, browser locale) and returns a valid destination id. */
export function resolveId(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  if (BY_ID.has(raw)) return raw
  const c = COUNTRY_BY_ISO.get(raw)
  const sub = c?.subdivisions && (c.defaultSubdivision ?? c.subdivisions[0].code)
  return sub ? `${raw}-${sub}` : undefined
}

export const SUBDIVISION_LABEL: Record<SubdivisionKind, { one: string; many: string; adjective: string; short: string; national: string }> = {
  state: { one: 'State', many: 'states', adjective: 'State', short: 'state', national: 'Federal' },
  province: { one: 'Province', many: 'provinces', adjective: 'Provincial', short: 'prov.', national: 'Federal' },
  canton: { one: 'Canton', many: 'cantons', adjective: 'Cantonal', short: 'canton', national: 'Federal' },
  region: { one: 'Region', many: 'regions', adjective: 'Regional', short: 'regional', national: 'National' },
}

export const subdivisionLabel = (d: Pick<Country, 'subdivisionKind'>) => SUBDIVISION_LABEL[d.subdivisionKind ?? 'region']

export const REGIONS = ['Europe', 'Middle East', 'Asia-Pacific', 'Americas', 'Africa'] as const

export const flagOf = (iso2: string) => String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

export const DATA_YEAR = '2025'
