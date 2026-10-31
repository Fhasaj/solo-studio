/*
 * @name: Tax rates
 * @description: UK and Irish tax rates by tax year, used for estimates. Rates change every year: add the new year here
 * (or override a year in Admin → Money → Tax rates). Amounts are whole pounds or euro.
 * Figures were gathered on 31 October 2026 from published budget summaries; check them against GOV.UK and Revenue.
 * */

export type TaxCountry = 'uk' | 'uk-scotland' | 'ie';

export interface Band {
  // Upper limit of the band (taxable income for the UK, gross income for Ireland); null = no limit
  upTo: number | null;
  rate: number; // percent
}

export interface UkRates {
  country: 'uk' | 'uk-scotland';
  year: string; // "2026/27"
  personalAllowance: number;
  taperThreshold: number; // allowance falls £1 for every £2 above this
  bands: Band[]; // on taxable income (after the personal allowance)
  class4: { lower: number; upper: number; main: number; additional: number };
  tradingAllowance: number;
  vat: { threshold: number; standardRate: number };
  homeOfficeMonthly: Record<'25' | '51' | '101', number>;
  mileagePence: { carFirst10k: number; carAfter: number; motorcycle: number; bicycle: number };
  checked: string;
  sources: string[];
}

export interface IeRates {
  country: 'ie';
  year: string; // "2026"
  standardBand: number; // single person, taxed at the standard rate
  standardRate: number;
  higherRate: number;
  personalCredit: number;
  earnedIncomeCredit: number; // self-employed; shares a cap with the employee credit
  usc: { exemptUpTo: number; bands: Band[]; selfEmployedSurchargeOver: number; surchargeRate: number };
  prsi: { rate: number; minimum: number; threshold: number };
  vat: { threshold: number; standardRate: number };
  checked: string;
  sources: string[];
}

export type RateSet = UkRates | IeRates;

const UK_COMMON = {
  personalAllowance: 12_570,
  taperThreshold: 100_000,
  class4: { lower: 12_570, upper: 50_270, main: 6, additional: 2 },
  tradingAllowance: 1_000,
  vat: { threshold: 90_000, standardRate: 20 },
  homeOfficeMonthly: { '25': 10, '51': 18, '101': 26 },
  mileagePence: { carFirst10k: 45, carAfter: 25, motorcycle: 24, bicycle: 20 },
  checked: '2026-10-31',
};

const UK_BANDS: Band[] = [
  { upTo: 37_700, rate: 20 },
  { upTo: 125_140, rate: 40 },
  { upTo: null, rate: 45 },
];

export const BUILT_IN_RATES: RateSet[] = [
  { country: 'uk', year: '2025/26', ...UK_COMMON, bands: UK_BANDS, sources: ['https://www.gov.uk/income-tax-rates', 'https://www.gov.uk/self-employed-national-insurance-rates'] },
  { country: 'uk', year: '2026/27', ...UK_COMMON, bands: UK_BANDS, sources: ['https://www.gov.uk/income-tax-rates', 'https://www.gov.uk/self-employed-national-insurance-rates'] },
  {
    country: 'uk-scotland',
    year: '2025/26',
    ...UK_COMMON,
    // Starter to £15,397, basic to £27,491, intermediate to £43,662, higher to £75,000, advanced to £125,140 (total income)
    bands: [
      { upTo: 2_827, rate: 19 },
      { upTo: 14_921, rate: 20 },
      { upTo: 31_092, rate: 21 },
      { upTo: 62_430, rate: 42 },
      { upTo: 125_140, rate: 45 },
      { upTo: null, rate: 48 },
    ],
    sources: ['https://www.gov.uk/scottish-income-tax'],
  },
  {
    country: 'uk-scotland',
    year: '2026/27',
    ...UK_COMMON,
    // Starter to £16,537, basic to £29,526, intermediate to £43,662, higher to £75,000, advanced to £125,140 (total income)
    bands: [
      { upTo: 3_967, rate: 19 },
      { upTo: 16_956, rate: 20 },
      { upTo: 31_092, rate: 21 },
      { upTo: 62_430, rate: 42 },
      { upTo: 125_140, rate: 45 },
      { upTo: null, rate: 48 },
    ],
    sources: ['https://www.gov.scot/publications/scottish-budget-2026-2027/'],
  },
  {
    country: 'ie',
    year: '2025',
    standardBand: 44_000,
    standardRate: 20,
    higherRate: 40,
    personalCredit: 2_000,
    earnedIncomeCredit: 2_000,
    usc: {
      exemptUpTo: 13_000,
      bands: [
        { upTo: 12_012, rate: 0.5 },
        { upTo: 27_382, rate: 2 },
        { upTo: 70_044, rate: 3 },
        { upTo: null, rate: 8 },
      ],
      selfEmployedSurchargeOver: 100_000,
      surchargeRate: 3,
    },
    // 4.1% to September, 4.2% from October
    prsi: { rate: 4.125, minimum: 650, threshold: 5_000 },
    vat: { threshold: 42_500, standardRate: 23 },
    checked: '2026-10-31',
    sources: ['https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx'],
  },
  {
    country: 'ie',
    year: '2026',
    standardBand: 44_000,
    standardRate: 20,
    higherRate: 40,
    personalCredit: 2_000,
    earnedIncomeCredit: 2_000,
    usc: {
      exemptUpTo: 13_000,
      bands: [
        { upTo: 12_012, rate: 0.5 },
        { upTo: 28_700, rate: 2 },
        { upTo: 70_044, rate: 3 },
        { upTo: null, rate: 8 },
      ],
      selfEmployedSurchargeOver: 100_000,
      surchargeRate: 3,
    },
    // 4.2% to September, 4.35% from October
    prsi: { rate: 4.2375, minimum: 650, threshold: 5_000 },
    vat: { threshold: 42_500, standardRate: 23 },
    checked: '2026-10-31',
    sources: ['https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx', 'https://www.gov.ie/en/department-of-social-protection/publications/prsi-class-s-rates/'],
  },
];
