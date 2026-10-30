import type { Profile } from '../types'

export interface Preset {
  id: string
  label: string
  blurb: string
  /** Amounts in USD; converted to the display currency when applied. */
  profile: Profile
}

export const PRESETS: Preset[] = [
  {
    id: 'engineer', label: 'Tech professional', blurb: '$180k salary, modest portfolio',
    profile: { salary: 180000, gains: 10000, dividends: 4000, interest: 2000, netWorth: 400000, household: 'single' },
  },
  {
    id: 'executive', label: 'Senior executive', blurb: '$450k salary, family of four',
    profile: { salary: 450000, gains: 60000, dividends: 25000, interest: 10000, netWorth: 3000000, household: 'family' },
  },
  {
    id: 'remote', label: 'Remote worker', blurb: '$95k salary, renting solo',
    profile: { salary: 95000, gains: 0, dividends: 1000, interest: 1000, netWorth: 120000, household: 'single' },
  },
  {
    id: 'investor', label: 'Investor / FIRE', blurb: 'No salary, $5M portfolio',
    profile: { salary: 0, gains: 150000, dividends: 90000, interest: 30000, netWorth: 5000000, household: 'couple' },
  },
  {
    id: 'founder', label: 'Founder exit', blurb: '$8M one-off capital gain',
    profile: { salary: 0, gains: 8000000, dividends: 50000, interest: 50000, netWorth: 15000000, household: 'family' },
  },
  {
    id: 'retiree', label: 'Wealthy retiree', blurb: '$1.5M portfolio income',
    profile: { salary: 0, gains: 30000, dividends: 40000, interest: 20000, netWorth: 1500000, household: 'couple' },
  },
]
