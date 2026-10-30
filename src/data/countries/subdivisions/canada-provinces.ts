import type { Brackets, City, LocalTax, Subdivision, TaxSystem } from '../../../types'
import { I, rate, top } from '../../helpers'

/**
 * Provincial/territorial income tax for 2025 (CRA "Tax rates and income brackets, 2025";
 * Revenu Québec for Quebec). `credit` is the basic personal amount × the lowest provincial rate.
 */

const FEDERAL_BRACKETS: Brackets = [[57375, 0.145], [114750, 0.205], [177882, 0.26], [253414, 0.29], [I, 0.33]]
const FEDERAL_CREDIT = 2339
const FEDERAL_TOP = 0.33

const provincial = (name: string, credit: number, brackets: Brackets, o: Partial<LocalTax> = {}): LocalTax => ({ name: `${name} tax`, base: 'ordinary', credit, brackets, ...o })

function province(code: string, name: string, lat: number, lng: number, tax: LocalTax, cities: City[], extra: Partial<Subdivision> = {}): Subdivision {
  const surtax = tax.surtax?.reduce((s, [, r]) => s + r, 0) ?? 0
  const provincialTop = top(tax.brackets) * (1 + surtax)
  return {
    code, name, lat, lng, local: [tax], cities,
    regionalTopRate: rate(provincialTop),
    ...extra,
    headline: { topIncome: rate((extra.tax?.brackets ? top(extra.tax.brackets) : FEDERAL_TOP) + provincialTop), ...extra.headline },
  }
}

/** Quebec residents get a 16.5% abatement of basic federal tax and pay QPP/QPIP instead of CPP and part of EI. */
const QUEBEC_ABATEMENT = 0.835
const QUEBEC_TAX: Partial<TaxSystem> = {
  brackets: FEDERAL_BRACKETS.map(([b, r]) => [b, Math.round(r * QUEBEC_ABATEMENT * 100000) / 100000]),
  credits: [{ amount: Math.round(FEDERAL_CREDIT * QUEBEC_ABATEMENT) }],
  social: [
    { name: 'QPP', rate: 0.064, floor: 3500, cap: 71300 },
    { name: 'QPP2', rate: 0.04, floor: 71300, cap: 81200 },
    { name: 'QPIP parental insurance', rate: 0.00494, cap: 98000 },
    { name: 'EI', rate: 0.0131, cap: 65700 },
  ],
}

const ONTARIO_TAX = provincial('Ontario', 644, [[52886, 0.0505], [105775, 0.0915], [150000, 0.1116], [220000, 0.1216], [I, 0.1316]], { name: 'Ontario tax (incl. surtax)', surtax: [[5710, 0.2], [7307, 0.36]] })
/** Stepped premium (max C$900) expressed as brackets on taxable income. */
const ONTARIO_HEALTH_PREMIUM: LocalTax = { name: 'Ontario Health Premium', base: 'ordinary', brackets: [[20000, 0], [25000, 0.06], [36000, 0], [38500, 0.06], [48000, 0], [48600, 0.25], [72000, 0], [72600, 0.25], [200000, 0], [200600, 0.25], [I, 0]] }

export const CANADA_PROVINCES: Subdivision[] = [
  province('ON', 'Ontario', 43.65, -79.38, ONTARIO_TAX,
    [
      { name: 'Toronto', rent1: 1950, rent3: 3700, col: 72 },
      { name: 'Ottawa', rent1: 1600, rent3: 2800, col: 68 },
    ],
    { local: [ONTARIO_TAX, ONTARIO_HEALTH_PREMIUM], notes: ['Ontario surtax adds 20% + 36% of provincial tax above thresholds, plus the Ontario Health Premium (up to C$900).'] },
  ),
  province('QC', 'Quebec', 45.5, -73.57,
    provincial('Quebec', 2600, [[53255, 0.14], [106495, 0.19], [129590, 0.24], [I, 0.2575]]),
    [
      { name: 'Montreal', rent1: 1300, rent3: 2400, col: 66 },
      { name: 'Quebec City', rent1: 1000, rent3: 1800, col: 62 },
    ],
    { tax: QUEBEC_TAX, notes: ['Quebec runs its own income tax. Federal tax is shown after the 16.5% Quebec abatement; QPP and QPIP replace CPP and part of EI.'] },
  ),
  province('BC', 'British Columbia', 49.28, -123.12,
    provincial('British Columbia', 654, [[49279, 0.0506], [98560, 0.077], [113158, 0.105], [137407, 0.1229], [186306, 0.147], [259829, 0.168], [I, 0.205]]),
    [
      { name: 'Vancouver', rent1: 2100, rent3: 4000, col: 74 },
      { name: 'Victoria', rent1: 1700, rent3: 3000, col: 72 },
    ],
    { utc: '-8' },
  ),
  province('AB', 'Alberta', 51.05, -114.07,
    provincial('Alberta', 1786, [[60000, 0.08], [151234, 0.1], [181481, 0.12], [241974, 0.13], [362961, 0.14], [I, 0.15]]),
    [
      { name: 'Calgary', rent1: 1450, rent3: 2600, col: 68 },
      { name: 'Edmonton', rent1: 1200, rent3: 2100, col: 64 },
    ],
    { notes: ['Lowest provincial tax of the large provinces, with no provincial sales tax.'], utc: '-7' },
  ),
  province('SK', 'Saskatchewan', 52.13, -106.67, provincial('Saskatchewan', 2047, [[53463, 0.105], [152750, 0.125], [I, 0.145]]), [{ name: 'Saskatoon', rent1: 1000, rent3: 1800, col: 62 }], { utc: '-6' }),
  province('MB', 'Manitoba', 49.9, -97.14, provincial('Manitoba', 1704, [[47564, 0.108], [101200, 0.1275], [I, 0.174]]), [{ name: 'Winnipeg', rent1: 1050, rent3: 1900, col: 62 }], {
    notes: ['From 2025 the Manitoba basic personal amount is phased out between C$200k and C$400k of income (not modelled).'], utc: '-6',
  }),
  province('NS', 'Nova Scotia', 44.65, -63.58, provincial('Nova Scotia', 1032, [[30507, 0.0879], [61015, 0.1495], [95883, 0.1667], [154650, 0.175], [I, 0.21]]), [{ name: 'Halifax', rent1: 1500, rent3: 2600, col: 68 }], { utc: '-4' }),
  province('NB', 'New Brunswick', 46.09, -64.78, provincial('New Brunswick', 1259, [[51306, 0.094], [102614, 0.14], [190060, 0.16], [I, 0.195]]), [{ name: 'Moncton', rent1: 1100, rent3: 1900, col: 62 }], { utc: '-4' }),
  province('PE', 'Prince Edward Island', 46.24, -63.13, provincial('PEI', 1354, [[33328, 0.095], [64656, 0.1347], [105000, 0.166], [140000, 0.1762], [I, 0.19]]), [{ name: 'Charlottetown', rent1: 1200, rent3: 2000, col: 64 }], { micro: true, utc: '-4' }),
  province('NL', 'Newfoundland and Labrador', 47.56, -52.71,
    provincial('Newfoundland and Labrador', 963, [[44192, 0.087], [88382, 0.145], [157792, 0.158], [220910, 0.178], [282214, 0.198], [564429, 0.208], [1128858, 0.213], [I, 0.218]]),
    [{ name: "St. John's", rent1: 1000, rent3: 1800, col: 64 }],
    { utc: '-3.5' },
  ),
  province('YT', 'Yukon', 60.72, -135.06, provincial('Yukon', 1032, [[57375, 0.064], [114750, 0.09], [177882, 0.109], [500000, 0.128], [I, 0.15]]), [{ name: 'Whitehorse', rent1: 1500, rent3: 2600, col: 76 }], { utc: '-7' }),
  province('NT', 'Northwest Territories', 62.45, -114.37, provincial('NWT', 1053, [[51964, 0.059], [103930, 0.086], [168967, 0.122], [I, 0.1405]]), [{ name: 'Yellowknife', rent1: 1600, rent3: 2800, col: 80 }], {
    notes: ['Northern residents can claim extra deductions (not modelled).'], utc: '-7',
  }),
  province('NU', 'Nunavut', 63.75, -68.52, provincial('Nunavut', 771, [[54707, 0.04], [109413, 0.07], [177881, 0.09], [I, 0.115]]), [{ name: 'Iqaluit', rent1: 2200, rent3: 3800, col: 110 }], {
    notes: ['Lowest provincial/territorial rates in Canada, but very high living costs.', 'Northern residents can claim extra deductions (not modelled).'], utc: '-5',
  }),
]
