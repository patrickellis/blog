import type { Brackets, City, LocalTax, Subdivision } from '../../../types'
import { I, rate, top } from '../../helpers'

/**
 * State income taxes for tax year 2025 (single filer), from Tax Foundation's
 * "State Individual Income Tax Rates and Brackets, 2025". Personal exemptions are folded into
 * `allowance`; exemption credits into `credit`. Allowances that fully phase out at typical
 * expat incomes (CT, UT, WI standard deduction, OR credit) are omitted.
 */

const FEDERAL_TOP = 0.37

const income = (state: string, brackets: Brackets, o: Partial<LocalTax> = {}): LocalTax => ({ name: `${state} income tax`, base: 'allIncome', brackets, ...o })
const payroll = (name: string, brackets: Brackets): LocalTax => ({ name, base: 'salary', brackets })
const NO_TAX = 'No state income tax'

function state(code: string, name: string, lat: number, lng: number, local: LocalTax[] | undefined, cities: City[], extra: Partial<Subdivision> = {}): Subdivision {
  const stateTop = (local ?? []).filter((l) => l.base === 'allIncome').reduce((s, l) => s + top(l.brackets), 0)
  const cityTop = (cities[0].local ?? []).filter((l) => l.base !== 'gains').reduce((s, l) => s + top(l.brackets), 0)
  return {
    code, name, lat, lng, local, cities,
    regionalTopRate: rate(stateTop + cityTop),
    ...extra,
    headline: { topIncome: rate(FEDERAL_TOP + stateTop + cityTop), ...extra.headline },
  }
}

export const US_STATES: Subdivision[] = [
  state('AL', 'Alabama', 33.52, -86.8, [income('Alabama', [[500, 0.02], [3000, 0.04], [I, 0.05]], { allowance: 4000 })], [
    { name: 'Birmingham', rent1: 1300, rent3: 2300, col: 64, local: [payroll('Birmingham occupational tax', [[I, 0.01]])] },
  ], { notes: ['Alabama lets you deduct federal income tax paid (not modelled).'] }),
  state('AK', 'Alaska', 61.22, -149.9, undefined, [{ name: 'Anchorage', rent1: 1500, rent3: 2700, col: 82, note: NO_TAX }], { notes: ['No state income or sales tax; residents receive the Permanent Fund Dividend.'], utc: '-9' }),
  state('AZ', 'Arizona', 33.45, -112.07, [income('Arizona', [[I, 0.025]], { allowance: 15750, gainsInclusion: 0.75 })], [{ name: 'Phoenix', rent1: 1600, rent3: 2800, col: 68 }], {
    notes: ['Flat 2.5% rate; 25% of long-term capital gains are exempt.'], utc: '-7',
  }),
  state('AR', 'Arkansas', 34.75, -92.29, [income('Arkansas', [[4600, 0.02], [I, 0.039]], { allowance: 2410, credit: 29, gainsInclusion: 0.5 })], [{ name: 'Little Rock', rent1: 1100, rent3: 1900, col: 60 }], {
    notes: ['50% of long-term capital gains are exempt.'], utc: '-6',
  }),
  state('CA', 'California', 37.77, -122.42, [
    income('California', [[11079, 0.01], [26264, 0.02], [41452, 0.04], [57542, 0.06], [72724, 0.08], [371479, 0.093], [445771, 0.103], [742953, 0.113], [1000000, 0.123], [I, 0.133]], { allowance: 5706, credit: 153 }),
    payroll('CA SDI', [[I, 0.012]]),
  ], [
    { name: 'San Francisco', rent1: 3400, rent3: 6500, col: 95 },
    { name: 'Los Angeles', rent1: 2800, rent3: 5200, col: 85 },
    { name: 'San Diego', rent1: 2900, rent3: 5200, col: 82 },
  ], { notes: ['Capital gains are taxed as ordinary income; top rate includes the 1% surtax above $1M. SDI payroll tax applies to all wages.'], utc: '-8' }),
  state('CO', 'Colorado', 39.74, -104.99, [income('Colorado', [[I, 0.044]], { allowance: 15750 }), payroll('CO FAMLI', [[176100, 0.0045], [I, 0]])], [{ name: 'Denver', rent1: 1900, rent3: 3500, col: 76 }], { utc: '-7' }),
  state('CT', 'Connecticut', 41.05, -73.54, [
    income('Connecticut', [[10000, 0.02], [50000, 0.045], [100000, 0.055], [200000, 0.06], [250000, 0.065], [500000, 0.069], [I, 0.0699]]),
    payroll('CT Paid Leave', [[176100, 0.005], [I, 0]]),
  ], [{ name: 'Stamford', rent1: 2700, rent3: 4800, col: 86 }], { notes: ['The personal exemption phases out completely above ~$71k.'] }),
  state('DE', 'Delaware', 39.74, -75.55, [income('Delaware', [[2000, 0], [5000, 0.022], [10000, 0.039], [20000, 0.048], [25000, 0.052], [60000, 0.0555], [I, 0.066]], { allowance: 3250, credit: 110 })], [
    { name: 'Wilmington', rent1: 1600, rent3: 2700, col: 72, local: [payroll('Wilmington wage tax', [[I, 0.0125]])] },
  ], { micro: true, notes: ['No sales tax.'] }),
  state('DC', 'District of Columbia', 38.9, -77.04, [income('DC', [[10000, 0.04], [40000, 0.06], [60000, 0.065], [250000, 0.085], [500000, 0.0925], [1000000, 0.0975], [I, 0.1075]], { allowance: 15750 })], [
    { name: 'Washington', rent1: 2500, rent3: 4800, col: 86 },
  ], { micro: true }),
  state('FL', 'Florida', 25.76, -80.19, undefined, [
    { name: 'Miami', rent1: 3000, rent3: 6000, col: 82, note: NO_TAX },
    { name: 'Tampa', rent1: 2100, rent3: 3600, col: 72, note: NO_TAX },
  ], { notes: ['No state income tax and no estate tax — the most popular US tax move.'] }),
  state('GA', 'Georgia', 33.75, -84.39, [income('Georgia', [[I, 0.0519]], { allowance: 12000 })], [{ name: 'Atlanta', rent1: 1900, rent3: 3400, col: 74 }]),
  state('HI', 'Hawaii', 21.31, -157.86, [
    income('Hawaii', [[9600, 0.014], [14400, 0.032], [19200, 0.055], [24000, 0.064], [36000, 0.068], [48000, 0.072], [125000, 0.076], [175000, 0.079], [225000, 0.0825], [275000, 0.09], [325000, 0.1], [I, 0.11]], { allowance: 5544, gainsInclusion: 0 }),
    { name: 'Hawaii capital gains tax', base: 'gains', brackets: [[I, 0.0725]] },
  ], [{ name: 'Honolulu', rent1: 2300, rent3: 4300, col: 96 }], { notes: ['Long-term capital gains are capped at 7.25%.'], utc: '-10' }),
  state('ID', 'Idaho', 43.62, -116.2, [income('Idaho', [[4811, 0], [I, 0.053]], { allowance: 15750 })], [{ name: 'Boise', rent1: 1500, rent3: 2600, col: 70 }], { utc: '-7' }),
  state('IL', 'Illinois', 41.88, -87.63, [income('Illinois', [[I, 0.0495]], { allowance: 2850 })], [{ name: 'Chicago', rent1: 2200, rent3: 4000, col: 80 }], { utc: '-6' }),
  state('IN', 'Indiana', 39.77, -86.16, [income('Indiana', [[I, 0.03]], { allowance: 1000 })], [
    { name: 'Indianapolis', rent1: 1300, rent3: 2300, col: 66, local: [income('Marion County', [[I, 0.0202]], { allowance: 1000 })] },
  ], { notes: ['Counties add their own income tax (about 1–3%).'] }),
  state('IA', 'Iowa', 41.59, -93.62, [income('Iowa', [[I, 0.038]], { allowance: 15750, credit: 40 })], [{ name: 'Des Moines', rent1: 1100, rent3: 2000, col: 64 }], { utc: '-6' }),
  state('KS', 'Kansas', 38.98, -94.67, [income('Kansas', [[23000, 0.052], [I, 0.0558]], { allowance: 12765 })], [{ name: 'Overland Park', rent1: 1400, rent3: 2500, col: 68 }], { utc: '-6' }),
  state('KY', 'Kentucky', 38.25, -85.76, [income('Kentucky', [[I, 0.04]], { allowance: 3270 })], [
    { name: 'Louisville', rent1: 1200, rent3: 2100, col: 66, local: [payroll('Louisville occupational tax', [[I, 0.022]])] },
  ]),
  state('LA', 'Louisiana', 29.95, -90.07, [income('Louisiana', [[I, 0.03]], { allowance: 12500 })], [{ name: 'New Orleans', rent1: 1600, rent3: 2800, col: 72 }], {
    notes: ['Switched to a flat 3% income tax in 2025.'], utc: '-6',
  }),
  state('ME', 'Maine', 43.66, -70.26, [income('Maine', [[26800, 0.058], [63450, 0.0675], [I, 0.0715]], { allowance: 20150 })], [{ name: 'Portland (ME)', rent1: 1900, rent3: 3200, col: 80 }]),
  state('MD', 'Maryland', 39.29, -76.61, [
    income('Maryland', [[1000, 0.02], [2000, 0.03], [3000, 0.04], [100000, 0.0475], [125000, 0.05], [150000, 0.0525], [250000, 0.055], [500000, 0.0575], [1000000, 0.0625], [I, 0.065]], { allowance: 6550 }),
  ], [{ name: 'Baltimore', rent1: 1500, rent3: 2600, col: 72, local: [income('Baltimore City', [[I, 0.032]], { allowance: 6550 })] }], {
    notes: ['Counties levy a piggyback income tax of 2.25–3.3%. A 2% capital-gains surcharge applies above $350k of income from 2025 (not modelled).'],
  }),
  state('MA', 'Massachusetts', 42.36, -71.06, [income('Massachusetts', [[1083150, 0.05], [I, 0.09]], { allowance: 4400 }), payroll('MA PFML', [[176100, 0.0046], [I, 0]])], [
    { name: 'Boston', rent1: 3200, rent3: 6000, col: 90 },
  ], { notes: ['Flat 5% plus a 4% “millionaire’s tax” above $1.08M. Short-term gains are taxed at 8.5% (not modelled).'] }),
  state('MI', 'Michigan', 42.33, -83.05, [income('Michigan', [[I, 0.0425]], { allowance: 5800 })], [
    { name: 'Detroit', rent1: 1300, rent3: 2200, col: 68, local: [income('Detroit city', [[I, 0.024]], { allowance: 600 })] },
  ], { notes: ['About 20 cities, including Detroit, levy their own income tax.'] }),
  state('MN', 'Minnesota', 44.98, -93.27, [income('Minnesota', [[32570, 0.0535], [106990, 0.068], [198630, 0.0785], [I, 0.0985]], { allowance: 14950 })], [
    { name: 'Minneapolis', rent1: 1600, rent3: 2800, col: 76 },
  ], { notes: ['An extra 1% applies to net investment income above $1M (not modelled).'], utc: '-6' }),
  state('MS', 'Mississippi', 32.3, -90.18, [income('Mississippi', [[10000, 0], [I, 0.044]], { allowance: 8300 })], [{ name: 'Jackson', rent1: 1000, rent3: 1700, col: 60 }], { utc: '-6' }),
  state('MO', 'Missouri', 39.1, -94.58, [income('Missouri', [[1313, 0], [2626, 0.02], [3939, 0.025], [5252, 0.03], [6565, 0.035], [7878, 0.04], [9191, 0.045], [I, 0.047]], { allowance: 15750, gainsInclusion: 0 })], [
    { name: 'Kansas City', rent1: 1400, rent3: 2500, col: 68, local: [payroll('Kansas City earnings tax', [[I, 0.01]])] },
  ], { notes: ['Capital gains are fully exempt from Missouri income tax from 2025.'], utc: '-6' }),
  state('MT', 'Montana', 45.68, -111.04, [
    income('Montana', [[21100, 0.047], [I, 0.059]], { allowance: 15750, gainsInclusion: 0 }),
    { name: 'Montana capital gains tax', base: 'gains', brackets: [[21100, 0.03], [I, 0.041]] },
  ], [{ name: 'Bozeman', rent1: 1800, rent3: 3200, col: 74 }], { notes: ['Long-term capital gains have their own lower rates (3% / 4.1%). No sales tax.'], utc: '-7' }),
  state('NE', 'Nebraska', 41.26, -95.93, [income('Nebraska', [[4030, 0.0246], [24120, 0.0351], [38870, 0.0501], [I, 0.052]], { allowance: 8600, credit: 171 })], [
    { name: 'Omaha', rent1: 1200, rent3: 2100, col: 66 },
  ], { utc: '-6' }),
  state('NV', 'Nevada', 36.17, -115.14, undefined, [{ name: 'Las Vegas', rent1: 1400, rent3: 2400, col: 72, note: NO_TAX }], { utc: '-8' }),
  state('NH', 'New Hampshire', 42.99, -71.46, undefined, [{ name: 'Manchester', rent1: 1800, rent3: 3000, col: 78, note: NO_TAX }], {
    notes: ['The tax on interest and dividends was repealed from 2025. No sales tax.'],
  }),
  state('NJ', 'New Jersey', 40.72, -74.05, [
    income('New Jersey', [[20000, 0.014], [35000, 0.0175], [40000, 0.035], [75000, 0.05525], [500000, 0.0637], [1000000, 0.0897], [I, 0.1075]], { allowance: 1000 }),
    payroll('NJ disability & family leave', [[165400, 0.0056], [I, 0]]),
  ], [{ name: 'Jersey City', rent1: 3000, rent3: 5200, col: 88 }]),
  state('NM', 'New Mexico', 35.08, -106.65, [income('New Mexico', [[5500, 0.015], [16500, 0.032], [33500, 0.043], [66500, 0.047], [210000, 0.049], [I, 0.059]], { allowance: 15750 })], [
    { name: 'Albuquerque', rent1: 1200, rent3: 2100, col: 66 },
  ], { utc: '-7' }),
  state('NY', 'New York', 40.71, -74.0, [
    income('New York State', [[8500, 0.04], [11700, 0.045], [13900, 0.0525], [80650, 0.055], [215400, 0.06], [1077550, 0.0685], [5000000, 0.0965], [25000000, 0.103], [I, 0.109]], { allowance: 8000 }),
    payroll('NY Paid Family Leave', [[91373, 0.00388], [I, 0]]),
  ], [
    { name: 'New York City', rent1: 4300, rent3: 9500, col: 100, local: [income('NYC', [[12000, 0.03078], [25000, 0.03762], [50000, 0.03819], [I, 0.03876]], { allowance: 8000 })] },
  ]),
  state('NC', 'North Carolina', 35.23, -80.84, [income('North Carolina', [[I, 0.0425]], { allowance: 12750 })], [{ name: 'Charlotte', rent1: 1700, rent3: 3000, col: 72 }]),
  state('ND', 'North Dakota', 46.88, -96.79, [income('North Dakota', [[48475, 0], [244825, 0.0195], [I, 0.025]], { allowance: 15750, gainsInclusion: 0.6 })], [
    { name: 'Fargo', rent1: 1000, rent3: 1700, col: 64 },
  ], { notes: ['40% of long-term capital gains are exempt.'], utc: '-6' }),
  state('OH', 'Ohio', 39.96, -83.0, [income('Ohio', [[26050, 0], [100000, 0.0275], [I, 0.03125]], { allowance: 1900 })], [
    { name: 'Columbus', rent1: 1300, rent3: 2300, col: 66, local: [payroll('Columbus city income tax', [[I, 0.025]])] },
  ], { notes: ['Most Ohio cities tax wages at 1–3%.'] }),
  state('OK', 'Oklahoma', 35.47, -97.52, [income('Oklahoma', [[1000, 0.0025], [2500, 0.0075], [3750, 0.0175], [4900, 0.0275], [7200, 0.0375], [I, 0.0475]], { allowance: 7350 })], [
    { name: 'Oklahoma City', rent1: 1100, rent3: 1900, col: 62 },
  ], { utc: '-6' }),
  state('OR', 'Oregon', 45.52, -122.68, [
    income('Oregon', [[4400, 0.0475], [11050, 0.0675], [125000, 0.0875], [I, 0.099]], { allowance: 2800 }),
    payroll('OR Paid Leave & transit tax', [[176100, 0.007], [I, 0.001]]),
  ], [
    { name: 'Portland', rent1: 1700, rent3: 2900, col: 80, local: [income('Portland Metro & Multnomah', [[125000, 0], [250000, 0.025], [I, 0.04]])] },
  ], { notes: ['No sales tax. Portland-area residents pay up to 4% extra above $125k.'], utc: '-8' }),
  state('PA', 'Pennsylvania', 39.95, -75.17, [income('Pennsylvania', [[I, 0.0307]])], [
    { name: 'Philadelphia', rent1: 1900, rent3: 3300, col: 78, local: [payroll('Philadelphia wage tax', [[I, 0.0374]])] },
  ], { notes: ['Flat 3.07% with no standard deduction; most municipalities add a 1–3.74% earned-income tax.'] }),
  state('RI', 'Rhode Island', 41.82, -71.41, [
    income('Rhode Island', [[79900, 0.0375], [181650, 0.0475], [I, 0.0599]], { allowance: 16000 }),
    payroll('RI TDI', [[87000, 0.012], [I, 0]]),
  ], [{ name: 'Providence', rent1: 1900, rent3: 3200, col: 78 }], { micro: true }),
  state('SC', 'South Carolina', 32.78, -79.93, [income('South Carolina', [[3640, 0], [18230, 0.03], [I, 0.06]], { allowance: 15750, gainsInclusion: 0.56 })], [
    { name: 'Charleston', rent1: 1900, rent3: 3300, col: 74 },
  ], { notes: ['44% of long-term capital gains are exempt.'] }),
  state('SD', 'South Dakota', 43.55, -96.73, undefined, [{ name: 'Sioux Falls', rent1: 1100, rent3: 1900, col: 64, note: NO_TAX }], {
    notes: ['No income tax; popular for trusts and residency of full-time travellers.'], utc: '-6',
  }),
  state('TN', 'Tennessee', 36.16, -86.78, undefined, [{ name: 'Nashville', rent1: 1900, rent3: 3300, col: 74, note: NO_TAX }], { utc: '-6' }),
  state('TX', 'Texas', 30.27, -97.74, undefined, [
    { name: 'Austin', rent1: 1900, rent3: 3700, col: 72, note: NO_TAX },
    { name: 'Houston', rent1: 1500, rent3: 2700, col: 70, note: NO_TAX },
    { name: 'Dallas', rent1: 1700, rent3: 3000, col: 72, note: NO_TAX },
  ], { notes: ['No state income tax; property taxes are among the highest in the US.'], utc: '-6' }),
  state('UT', 'Utah', 40.76, -111.89, [income('Utah', [[I, 0.045]])], [{ name: 'Salt Lake City', rent1: 1600, rent3: 2800, col: 72 }], { utc: '-7' }),
  state('VT', 'Vermont', 44.48, -73.21, [income('Vermont', [[49400, 0.0335], [119700, 0.066], [249700, 0.076], [I, 0.0875]], { allowance: 12950 })], [
    { name: 'Burlington', rent1: 1900, rent3: 3200, col: 80 },
  ]),
  state('VA', 'Virginia', 38.88, -77.1, [income('Virginia', [[3000, 0.02], [5000, 0.03], [17000, 0.05], [I, 0.0575]], { allowance: 9680 })], [
    { name: 'Arlington', rent1: 2400, rent3: 4300, col: 86 },
  ]),
  state('WA', 'Washington', 47.61, -122.33, [
    payroll('WA Cares & Paid Leave', [[176100, 0.01238], [I, 0.0058]]),
    { name: 'WA capital gains tax', base: 'gains', allowance: 278000, brackets: [[722000, 0.07], [I, 0.099]] },
  ], [{ name: 'Seattle', rent1: 2500, rent3: 4800, col: 88, note: 'No income tax on wages' }], {
    notes: ['No tax on wages, but a 7% capital-gains tax above $278k (9.9% above $1M) and a 0.58% long-term-care payroll tax.'], utc: '-8',
  }),
  state('WV', 'West Virginia', 38.35, -81.63, [income('West Virginia', [[10000, 0.0222], [25000, 0.0296], [40000, 0.0333], [60000, 0.0444], [I, 0.0482]], { allowance: 2000 })], [
    { name: 'Charleston (WV)', rent1: 1000, rent3: 1700, col: 60 },
  ]),
  state('WI', 'Wisconsin', 43.04, -87.91, [income('Wisconsin', [[14680, 0.035], [50480, 0.044], [323290, 0.053], [I, 0.0765]], { allowance: 700, gainsInclusion: 0.7 })], [
    { name: 'Milwaukee', rent1: 1300, rent3: 2300, col: 68 },
  ], { notes: ['30% of long-term capital gains are exempt.'], utc: '-6' }),
  state('WY', 'Wyoming', 43.48, -110.76, undefined, [
    { name: 'Jackson', rent1: 3000, rent3: 5500, col: 90, note: NO_TAX },
    { name: 'Cheyenne', rent1: 1100, rent3: 1900, col: 64, note: NO_TAX },
  ], { notes: ['No income tax, strong trust and asset-protection laws.'], utc: '-7' }),
]
