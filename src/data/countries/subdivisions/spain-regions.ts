import type { Brackets, City, LocalTax, Subdivision, WealthTax } from '../../../types'
import { I, rate, top } from '../../helpers'

/**
 * Regional IRPF scales for 2025 (AEAT "Manual práctico de Renta 2025", gravamen autonómico) and
 * regional wealth-tax rules (Ministerio de Hacienda, "Tributación Autonómica. Medidas 2025").
 * País Vasco (Bizkaia rules) and Navarra run their own foral systems that replace the state tax.
 */

const STATE_TOP = 0.245
const ALLOWANCE = 7550

const STATE_WEALTH: Brackets = [[167129, 0.002], [334253, 0.003], [668500, 0.005], [1337000, 0.009], [2674000, 0.013], [5348000, 0.017], [10696000, 0.021], [I, 0.035]]
const wealthTax = (region: string, brackets: Brackets, allowance = 700000, o: Partial<WealthTax> = {}): WealthTax => ({ name: `Wealth tax (${region})`, allowance, brackets, ...o })

function region(code: string, name: string, lat: number, lng: number, scale: Brackets, cities: City[], extra: Partial<Subdivision> = {}): Subdivision {
  const local: LocalTax[] = [{ name: `Regional income tax (${name})`, base: 'ordinary', allowance: ALLOWANCE, brackets: scale }]
  return { code, name, lat, lng, local, cities, regionalTopRate: top(scale), ...extra, headline: { topIncome: rate(STATE_TOP + top(scale)), ...extra.headline } }
}

const RELIEVED = 'None below €3M (100% regional relief; solidarity tax above)'

/** Bizkaia rules for 2025 (Hacienda Foral de Bizkaia, Renta 2025 manual); Gipuzkoa and Álava are near-identical. */
const BASQUE_SCALE: Brackets = [[17720, 0.23], [35440, 0.28], [53160, 0.35], [75910, 0.4], [105130, 0.45], [140130, 0.46], [204270, 0.47], [I, 0.49]]
const NAVARRA_SCALE: Brackets = [[4458, 0.13], [10030, 0.22], [21175, 0.25], [35663, 0.28], [51266, 0.365], [66869, 0.415], [89159, 0.44], [139310, 0.47], [195034, 0.49], [334344, 0.505], [I, 0.52]]

export const SPAIN_REGIONS: Subdivision[] = [
  region('MD', 'Madrid', 40.42, -3.7, [[13362, 0.085], [19004, 0.107], [35425, 0.128], [57320, 0.174], [I, 0.205]], [
    { name: 'Madrid', rent1: 1600, rent3: 2900, col: 58 },
  ], { wealth: null, headline: { wealth: RELIEVED }, notes: ['Lowest regional income tax in Spain and a 100% wealth-tax relief (the state solidarity tax still applies above €3M).'] }),
  region('CT', 'Catalonia', 41.39, 2.17, [[12500, 0.095], [22000, 0.125], [33000, 0.16], [53000, 0.19], [90000, 0.215], [120000, 0.235], [175000, 0.245], [I, 0.255]], [
    { name: 'Barcelona', rent1: 1500, rent3: 2800, col: 60 },
  ], {
    wealth: wealthTax('Catalonia', [[167129, 0.0021], [334253, 0.00315], [668500, 0.00525], [1337000, 0.00945], [2674000, 0.01365], [5348000, 0.01785], [10696000, 0.02205], [20000000, 0.0275], [I, 0.0348]], 500000),
    headline: { wealth: '0.21% – 3.48% above €500k' },
  }),
  region('VC', 'Valencia', 39.47, -0.38, [[12000, 0.09], [22000, 0.12], [32000, 0.15], [42000, 0.175], [52000, 0.2], [62000, 0.225], [72000, 0.25], [100000, 0.265], [150000, 0.275], [200000, 0.285], [I, 0.295]], [
    { name: 'Valencia', rent1: 1150, rent3: 1950, col: 52 },
    { name: 'Alicante', rent1: 1050, rent3: 1800, col: 52 },
  ], {
    wealth: wealthTax('Valencia', [[167129, 0.0025], [334253, 0.0037], [668500, 0.0062], [1337000, 0.0112], [2674000, 0.0162], [5348000, 0.0212], [10696000, 0.0262], [I, 0.035]], 1000000),
    headline: { wealth: '0.25% – 3.5% above €1M' },
    notes: ['Highest top regional income-tax rate in Spain (29.5%).'],
  }),
  region('AN', 'Andalusia', 37.39, -5.98, [[13000, 0.095], [21100, 0.12], [35200, 0.15], [60000, 0.185], [I, 0.225]], [
    { name: 'Málaga', rent1: 1300, rent3: 2300, col: 55 },
    { name: 'Seville', rent1: 1000, rent3: 1800, col: 52 },
  ], { wealth: null, headline: { wealth: RELIEVED } }),
  region('IB', 'Balearic Islands', 39.57, 2.65, [[10000, 0.09], [18000, 0.1125], [30000, 0.1425], [48000, 0.175], [70000, 0.19], [90000, 0.2175], [120000, 0.2275], [175000, 0.2375], [I, 0.2475]], [
    { name: 'Palma', rent1: 1500, rent3: 2700, col: 60 },
  ], {
    wealth: wealthTax('Balearic Islands', [[170472, 0.0028], [340937, 0.0041], [681870, 0.0069], [1336740, 0.0124], [2727479, 0.0179], [5454958, 0.0235], [10909916, 0.029], [I, 0.0345]], 3000000),
    headline: { wealth: '0.28% – 3.45% above €3M' },
  }),
  region('CN', 'Canary Islands', 28.12, -15.43, [[13748, 0.09], [19422, 0.115], [35924, 0.14], [57566, 0.185], [93268, 0.235], [123745, 0.25], [I, 0.26]], [
    { name: 'Las Palmas', rent1: 1000, rent3: 1800, col: 55 },
    { name: 'Santa Cruz de Tenerife', rent1: 950, rent3: 1700, col: 54 },
  ], { notes: ['Lower indirect tax (IGIC 7% instead of 21% VAT).'], utc: '+0' }),
  region('AR', 'Aragon', 41.65, -0.89, [[13072.5, 0.095], [21210, 0.12], [36960, 0.15], [52500, 0.185], [60000, 0.205], [80000, 0.23], [90000, 0.24], [130000, 0.25], [I, 0.255]], [
    { name: 'Zaragoza', rent1: 850, rent3: 1500, col: 52 },
  ]),
  region('AS', 'Asturias', 43.36, -5.85, [[12450, 0.09], [17707.2, 0.12], [33007.2, 0.14], [53407.2, 0.192], [70000, 0.215], [90000, 0.225], [175000, 0.25], [I, 0.26]], [
    { name: 'Oviedo', rent1: 750, rent3: 1300, col: 52 },
  ], {
    wealth: wealthTax('Asturias', [[167129, 0.0022], [334253, 0.0033], [668500, 0.0056], [1337000, 0.0102], [2674000, 0.0148], [5348000, 0.0197], [10696000, 0.0248], [I, 0.03]]),
    headline: { wealth: '0.22% – 3% above €700k' },
  }),
  region('CB', 'Cantabria', 43.46, -3.81, [[13000, 0.085], [21000, 0.11], [35200, 0.145], [60000, 0.18], [90000, 0.225], [I, 0.245]], [
    { name: 'Santander', rent1: 900, rent3: 1600, col: 54 },
  ], {
    wealth: wealthTax('Cantabria', [[167129, 0.0024], [334253, 0.0036], [668500, 0.0061], [1337000, 0.0109], [2674000, 0.0157], [5348000, 0.0206], [10696000, 0.0254], [I, 0.0303]], 700000, { threshold: 3700000 }),
    headline: { wealth: '100% relief unless net wealth exceeds €3.7M' },
  }),
  region('CL', 'Castile and León', 41.65, -4.72, [[12450, 0.09], [20200, 0.12], [35200, 0.14], [53407.2, 0.185], [I, 0.215]], [
    { name: 'Valladolid', rent1: 750, rent3: 1300, col: 50 },
  ]),
  region('CM', 'Castilla-La Mancha', 39.86, -4.03, [[12450, 0.095], [20200, 0.12], [35200, 0.15], [60000, 0.185], [I, 0.225]], [
    { name: 'Toledo', rent1: 750, rent3: 1300, col: 50 },
  ]),
  region('EX', 'Extremadura', 39.47, -6.37, [[12450, 0.08], [20200, 0.1], [24200, 0.16], [35200, 0.175], [60000, 0.21], [80200, 0.235], [99200, 0.24], [120200, 0.245], [I, 0.25]], [
    { name: 'Cáceres', rent1: 650, rent3: 1100, col: 48 },
  ], { wealth: null, headline: { wealth: RELIEVED } }),
  region('GA', 'Galicia', 43.36, -8.41, [[12985.35, 0.09], [21068.6, 0.1165], [35200, 0.149], [60000, 0.184], [I, 0.225]], [
    { name: 'A Coruña', rent1: 850, rent3: 1500, col: 52 },
  ], {
    wealth: wealthTax('Galicia, after 50% relief', STATE_WEALTH.map(([b, r]) => [b, r / 2])),
    headline: { wealth: '0.1% – 1.75% above €700k (50% relief)' },
  }),
  region('MC', 'Murcia', 37.99, -1.13, [[12450, 0.095], [20200, 0.112], [34000, 0.133], [60000, 0.179], [I, 0.225]], [
    { name: 'Murcia', rent1: 750, rent3: 1300, col: 50 },
  ]),
  region('RI', 'La Rioja', 42.47, -2.45, [[12450, 0.08], [20200, 0.106], [35200, 0.136], [40000, 0.178], [50000, 0.183], [60000, 0.19], [120000, 0.245], [I, 0.27]], [
    { name: 'Logroño', rent1: 750, rent3: 1300, col: 50 },
  ], { wealth: null, headline: { wealth: RELIEVED }, notes: ['A 100% wealth-tax relief was reintroduced from 2025.'] }),
  {
    code: 'PV', name: 'Basque Country', lat: 43.26, lng: -2.93,
    tax: {
      allowance: 0,
      employmentDeduction: { pct: 1, cap: 3000 },
      brackets: BASQUE_SCALE,
      credits: [{ amount: 1583 }],
      capitalSchedule: { name: 'Savings income', brackets: [[2500, 0.2], [10000, 0.21], [15000, 0.22], [30000, 0.23], [I, 0.25]] },
      wealthFloor: undefined,
    },
    wealth: wealthTax('Bizkaia', [[800000, 0.002], [1600000, 0.006], [3200000, 0.01], [6400000, 0.015], [12800000, 0.0175], [I, 0.02]], 800000),
    excludeRegimes: ['es-beckham'],
    cities: [
      { name: 'Bilbao', rent1: 1150, rent3: 2000, col: 62 },
      { name: 'San Sebastián', rent1: 1400, rent3: 2500, col: 64 },
    ],
    headline: { topIncome: top(BASQUE_SCALE), cgt: '20% – 25%', dividends: '20% – 25%', wealth: '0.2% – 2% above €800k' },
    notes: [
      'Foral system: the Basque provinces levy the whole income tax themselves (Bizkaia rules shown).',
      'The state solidarity tax and the Beckham law do not apply; the Basque impatriate regime (partial salary exemption) is not modelled.',
    ],
  },
  {
    code: 'NC', name: 'Navarre', lat: 42.81, lng: -1.64,
    tax: {
      allowance: 0,
      brackets: NAVARRA_SCALE,
      credits: [{ amount: 1084 }, { amount: 400 }],
      capitalSchedule: { name: 'Savings income', brackets: [[6000, 0.2], [10000, 0.22], [15000, 0.24], [200000, 0.26], [300000, 0.27], [I, 0.28]] },
      wealthFloor: undefined,
    },
    wealth: wealthTax('Navarre', [[155512, 0.0016], [311024, 0.0024], [622048, 0.004], [1244095, 0.0072], [2488190, 0.0104], [4976380, 0.0136], [9952760, 0.0168], [11003785, 0.02], [I, 0.035]], 550000),
    excludeRegimes: ['es-beckham'],
    cities: [{ name: 'Pamplona', rent1: 950, rent3: 1700, col: 58 }],
    headline: { topIncome: top(NAVARRA_SCALE), cgt: '20% – 28%', dividends: '20% – 28%', wealth: '0.16% – 3.5% above €550k' },
    notes: [
      'Foral system: Navarre levies the whole income tax itself, with personal and work deductions taken from the tax due.',
      'The state solidarity tax and the Beckham law do not apply; Navarre’s own impatriate regime is not modelled.',
    ],
  },
]
