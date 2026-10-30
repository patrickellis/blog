import type { Country } from '../../types'
import { americas } from './americas'
import { asiaPacific } from './asia-pacific'
import { europe } from './europe'
import { middleEastAfrica } from './middle-east-africa'

export const COUNTRIES: Country[] = [...europe, ...middleEastAfrica, ...asiaPacific, ...americas].sort((a, b) => a.name.localeCompare(b.name))

export const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso2, c]))
export const BY_NUM = new Map(COUNTRIES.map((c) => [c.num, c]))

export const REGIONS = ['Europe', 'Middle East', 'Asia-Pacific', 'Americas', 'Africa'] as const

export const flagOf = (iso2: string) => String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

export const DATA_YEAR = '2025'
