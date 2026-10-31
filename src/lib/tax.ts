/*
 * @name: Tax estimates
 * @description: Income tax and social insurance on business profit, for the UK (including Scottish rates) and Ireland.
 * The estimate is the extra tax your business profit causes on top of any other income (like a salary), so it shows
 * what to set aside. Estimates only: they don't cover every relief, allowance or situation.
 * */

import { addDays } from './format';
import type { Band, IeRates, RateSet, TaxCountry, UkRates } from './taxRates';

export interface TaxYear {
  label: string; // "2026/27" or "2026"
  start: string; // YYYY-MM-DD
  end: string;
}

// UK tax years run 6 April to 5 April; Irish ones are calendar years
export function taxYearFor(day: string, country: TaxCountry): TaxYear {
  const year = Number(day.slice(0, 4));
  if (country === 'ie') return { label: String(year), start: `${year}-01-01`, end: `${year}-12-31` };
  const startYear = day >= `${year}-04-06` ? year : year - 1;
  return { label: `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`, start: `${startYear}-04-06`, end: `${startYear + 1}-04-05` };
}

export function previousTaxYear(year: TaxYear, country: TaxCountry) {
  return taxYearFor(addDays(year.start, -1), country);
}

// Tax across bands, e.g. 20% up to 37,700 then 40% …
function banded(amount: number, bands: Band[]) {
  let tax = 0;
  let lower = 0;
  for (const band of bands) {
    const upper = band.upTo ?? Infinity;
    if (amount <= lower) break;
    tax += ((Math.min(amount, upper) - lower) * band.rate) / 100;
    lower = upper;
  }
  return tax;
}

function ukIncomeTax(income: number, rates: UkRates) {
  const allowance = Math.max(0, rates.personalAllowance - Math.max(0, income - rates.taperThreshold) / 2);
  return banded(Math.max(0, income - allowance), rates.bands);
}

export interface TaxEstimate {
  profit: number;
  incomeTax: number;
  // Class 4 NI (UK) or PRSI (Ireland)
  socialInsurance: number;
  socialInsuranceLabel: string;
  // USC (Ireland only)
  usc: number;
  total: number;
  effectiveRate: number; // of profit, percent
  notes: string[];
}

export function estimateUk(profit: number, otherIncome: number, rates: UkRates): TaxEstimate {
  const p = Math.max(0, profit);
  const incomeTax = ukIncomeTax(otherIncome + p, rates) - ukIncomeTax(otherIncome, rates);
  const { lower, upper, main, additional } = rates.class4;
  const class4 = (Math.max(0, Math.min(p, upper) - lower) * main) / 100 + (Math.max(0, p - upper) * additional) / 100;
  const total = incomeTax + class4;
  const notes = [
    'Class 2 National Insurance is no longer charged on profits above the small profits threshold; you can pay it voluntarily to protect your State Pension record if your profits are low.',
  ];
  if (rates.country === 'uk-scotland') notes.push('Uses Scottish income tax rates; National Insurance is the same across the UK.');
  return { profit: p, incomeTax, socialInsurance: class4, socialInsuranceLabel: 'Class 4 National Insurance', usc: 0, total, effectiveRate: p ? (total / p) * 100 : 0, notes };
}

function ieIncomeTax(income: number, rates: IeRates, credits: number) {
  const gross = (Math.min(income, rates.standardBand) * rates.standardRate) / 100 + (Math.max(0, income - rates.standardBand) * rates.higherRate) / 100;
  return Math.max(0, gross - credits);
}

function ieUsc(income: number, selfEmployed: number, rates: IeRates) {
  if (income <= rates.usc.exemptUpTo) return 0;
  // The extra 3% on self-employed income over €100,000
  const surcharge = (Math.max(0, selfEmployed - rates.usc.selfEmployedSurchargeOver) * rates.usc.surchargeRate) / 100;
  return banded(income, rates.usc.bands) + surcharge;
}

export function estimateIe(profit: number, otherIncome: number, rates: IeRates): TaxEstimate {
  const p = Math.max(0, profit);
  // The earned income credit shares a €2,000 cap with the employee (PAYE) credit, so a salary already uses it
  const credits = rates.personalCredit + rates.earnedIncomeCredit;
  const incomeTax = ieIncomeTax(otherIncome + p, rates, credits) - ieIncomeTax(otherIncome, rates, credits);
  const usc = ieUsc(otherIncome + p, p, rates) - ieUsc(otherIncome, 0, rates);
  const prsi = p >= rates.prsi.threshold ? Math.max((p * rates.prsi.rate) / 100, rates.prsi.minimum) : 0;
  const total = incomeTax + usc + prsi;
  return {
    profit: p,
    incomeTax,
    socialInsurance: prsi,
    socialInsuranceLabel: 'PRSI (Class S)',
    usc,
    total,
    effectiveRate: p ? (total / p) * 100 : 0,
    notes: ['Assumes a single person. Married couples and civil partners can have a wider standard rate band.'],
  };
}

export function estimateTax(profit: number, otherIncome: number, rates: RateSet) {
  return rates.country === 'ie' ? estimateIe(profit, otherIncome, rates) : estimateUk(profit, otherIncome, rates);
}

export interface Deadline {
  date: string;
  label: string;
}

// The main filing and payment dates for a tax year
export function taxDeadlines(year: TaxYear, country: TaxCountry): Deadline[] {
  if (country === 'ie') {
    const next = Number(year.label) + 1;
    return [
      { date: `${year.label}-10-31`, label: `Preliminary tax for ${year.label} (at least 90% of this year's tax, or 100% of last year's)` },
      { date: `${next}-10-31`, label: `Form 11 return for ${year.label} and any balance due (later if you file on ROS)` },
    ];
  }
  const endYear = Number(year.end.slice(0, 4));
  return [
    { date: `${endYear}-01-31`, label: `First payment on account for ${year.label} (if your last bill was over £1,000)` },
    { date: `${endYear}-07-31`, label: `Second payment on account for ${year.label}` },
    { date: `${endYear + 1}-01-31`, label: `Final declaration (or Self Assessment return) for ${year.label} and the balance due` },
  ];
}

// Making Tax Digital quarters: standard (6 April …) or calendar (1 April …), each with its update deadline
export function mtdQuarters(year: TaxYear, calendar: boolean) {
  const startYear = Number(year.start.slice(0, 4));
  const y1 = startYear + 1;
  const quarters = calendar
    ? [
        [`${startYear}-04-01`, `${startYear}-06-30`],
        [`${startYear}-07-01`, `${startYear}-09-30`],
        [`${startYear}-10-01`, `${startYear}-12-31`],
        [`${y1}-01-01`, `${y1}-03-31`],
      ]
    : [
        [`${startYear}-04-06`, `${startYear}-07-05`],
        [`${startYear}-07-06`, `${startYear}-10-05`],
        [`${startYear}-10-06`, `${y1}-01-05`],
        [`${y1}-01-06`, `${y1}-04-05`],
      ];
  const due = [`${startYear}-08-07`, `${startYear}-11-07`, `${y1}-02-07`, `${y1}-05-07`];
  return quarters.map(([start, end], index) => ({ number: index + 1, start, end, due: due[index] }));
}
