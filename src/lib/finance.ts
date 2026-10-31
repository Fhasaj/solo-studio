/*
 * @name: Finance
 * @description: Bookkeeping figures for a tax year: income (from paid invoices and other income), allowable expenses,
 * mileage, working from home, profit, a tax estimate, Making Tax Digital quarters, the VAT threshold and VAT returns.
 * Uses the cash basis (money in and out when it actually moves), the default for UK sole traders.
 * */

import { GetSiteSettings } from './query/settings.query';
import {
  EXPENSE_CATEGORIES,
  GetTaxRateOverride,
  ListExpenses,
  ListInvoicesBetween,
  ListMileage,
  ListOtherIncome,
  ListVatReturns,
  type Expense,
  type MileageTrip,
} from './query/finance.query';
import type { InvoiceData } from './query/clients.query';
import { BUILT_IN_RATES, type IeRates, type RateSet, type TaxCountry, type UkRates } from './taxRates';
import { estimateTax, mtdQuarters, previousTaxYear, taxDeadlines, taxYearFor, type TaxYear } from './tax';
import { isRegisteredOn, vatPeriods, vatReturn, type VatProfile, type VatPurchase, type VatSale, type VatTreatment } from './vat';
import { addDays, addMonths, londonDay } from './format';
import type { SiteSettings } from './siteSettings';

export function taxCountry(settings = GetSiteSettings()): TaxCountry {
  return settings.taxCountry === 'ie' || settings.taxCountry === 'uk-scotland' ? settings.taxCountry : 'uk';
}

// Your saved override for the year, else the built-in rates for it, else the latest built-in year (flagged)
export function ratesFor(country: TaxCountry, year: string): { rates: RateSet; fallback: boolean } {
  const override = GetTaxRateOverride(country, year);
  if (override) return { rates: { ...override, country, year }, fallback: false };
  const exact = BUILT_IN_RATES.find((r) => r.country === country && r.year === year);
  if (exact) return { rates: exact, fallback: false };
  const latest = BUILT_IN_RATES.filter((r) => r.country === country).at(-1)!;
  return { rates: { ...latest, year }, fallback: true };
}

export function vatProfile(settings = GetSiteSettings(), day = londonDay(new Date())): VatProfile {
  const country = taxCountry(settings);
  const { rates } = ratesFor(country, taxYearFor(day, country).label);
  return {
    country,
    registered: settings.vatRegistered === 'yes',
    registeredFrom: settings.vatRegisteredFrom,
    number: settings.vatNumber,
    scheme: settings.vatScheme === 'cash' || settings.vatScheme === 'flat_rate' ? settings.vatScheme : 'invoice',
    flatRate: Number(settings.vatFlatRatePercent) || 0,
    standardRate: rates.vat.standardRate,
  };
}

// ---- Invoice amounts ----

// What an invoice contributes: the price excluding VAT, the VAT, and any card fee (which isn't business income)
export function invoiceParts(data: InvoiceData) {
  const net = data.lines.filter((line) => !line.fee).reduce((sum, line) => sum + line.amount, 0);
  return { net, vat: data.vat?.amount ?? 0, code: (data.vat?.code ?? 'not_registered') as VatTreatment['code'] };
}

// ---- Expenses ----

function expenseCost(expense: Expense, profile: VatProfile) {
  const share = expense.businessPercent / 100;
  // Reclaimable VAT is only taken off the cost when it's actually reclaimed (registered, and not on the Flat Rate Scheme)
  const reclaims = isRegisteredOn(profile, expense.date) && profile.scheme !== 'flat_rate';
  const net = reclaims ? expense.amount - expense.vat : expense.amount;
  return { cost: Math.round(net * share), vatReclaim: reclaims ? Math.round(expense.vat * share) : 0, net: Math.round((expense.amount - expense.vat) * share) };
}

// HMRC mileage: 45p a mile for the first 10,000 car miles in a tax year, 25p after; flat rates for bikes
export function mileageAmounts(trips: MileageTrip[], country: TaxCountry, settings: SiteSettings, rates: RateSet) {
  if (country === 'ie') {
    const cents = Number(settings.mileageRateIe) || 0;
    return trips.map((trip) => ({ ...trip, amount: Math.round(trip.distance * cents) }));
  }
  const pence = (rates as UkRates).mileagePence;
  let carMiles = 0;
  return [...trips]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((trip) => {
      if (trip.vehicle === 'motorcycle') return { ...trip, amount: Math.round(trip.distance * pence.motorcycle) };
      if (trip.vehicle === 'bicycle') return { ...trip, amount: Math.round(trip.distance * pence.bicycle) };
      const first = Math.max(0, Math.min(trip.distance, 10_000 - carMiles));
      carMiles += trip.distance;
      return { ...trip, amount: Math.round(first * pence.carFirst10k + (trip.distance - first) * pence.carAfter) };
    });
}

// ---- The year ----

export interface CategoryTotal {
  key: string;
  label: string;
  hmrc: string;
  amount: number; // pence, allowable cost
  allowable: boolean;
}

function categoryTotals(expenses: Expense[], profile: VatProfile, country: TaxCountry) {
  return EXPENSE_CATEGORIES.map((category) => {
    const items = expenses.filter((e) => e.category === category.key);
    let amount = items.reduce((sum, e) => sum + expenseCost(e, profile).cost, 0);
    // Ireland: equipment is written off over 8 years (12.5% a year), not all at once
    if (country === 'ie' && category.key === 'equipment') amount = Math.round(amount * 0.125);
    return { key: category.key, label: category.label, hmrc: category.hmrc, amount, allowable: category.allowable };
  });
}

function incomeFor(from: string, to: string, profile: VatProfile) {
  const invoices = ListInvoicesBetween(from, to, 'paid').map((row) => {
    const parts = invoiceParts(JSON.parse(row.data) as InvoiceData);
    return { ...row, ...parts };
  });
  const other = ListOtherIncome(from, to);
  const invoiceNet = invoices.reduce((sum, i) => sum + i.net, 0);
  const invoiceVat = invoices.reduce((sum, i) => sum + i.vat, 0);
  const otherNet = other.reduce((sum, i) => sum + i.amount, 0);
  const otherVat = other.reduce((sum, i) => sum + i.vat, 0);
  let turnover = invoiceNet + otherNet;
  // Flat Rate Scheme: the VAT you charge counts as income, less the flat-rate VAT you pay over
  if (profile.registered && profile.scheme === 'flat_rate') {
    const gross = turnover + invoiceVat + otherVat;
    turnover = gross - Math.round((gross * profile.flatRate) / 100);
  }
  return { invoices, other, turnover };
}

export function financeYear(yearLabel?: string) {
  const settings = GetSiteSettings();
  const country = taxCountry(settings);
  const today = londonDay(new Date());
  const current = taxYearFor(today, country);
  const year: TaxYear = yearLabel ? taxYearFor(country === 'ie' ? `${yearLabel}-06-01` : `${yearLabel.slice(0, 4)}-06-01`, country) : current;
  const { rates, fallback } = ratesFor(country, year.label);
  const profile = vatProfile(settings, year.end);

  const { invoices, other, turnover } = incomeFor(year.start, year.end, profile);
  const expenses = ListExpenses(year.start, year.end);
  const categories = categoryTotals(expenses, profile, country);
  const mileage = mileageAmounts(ListMileage(year.start, year.end), country, settings, rates);
  const mileageTotal = mileage.reduce((sum, trip) => sum + trip.amount, 0);

  // UK flat rate for working from home: months of the tax year so far, at your hours band
  let homeOffice = 0;
  if (country !== 'ie' && settings.homeOfficeBand !== 'none') {
    const end = year.end < today ? year.end : today;
    const months = Math.max(0, Math.min(12, Math.round((Date.parse(end) - Date.parse(year.start)) / (30.44 * 86_400_000))));
    homeOffice = months * ((rates as UkRates).homeOfficeMonthly[settings.homeOfficeBand as '25' | '51' | '101'] ?? 0) * 100;
  }

  const allowableExpenses = categories.filter((c) => c.allowable).reduce((sum, c) => sum + c.amount, 0) + mileageTotal + homeOffice;
  // UK: the £1,000 trading allowance can replace expenses when it's bigger (you can't claim both)
  const tradingAllowance = country !== 'ie' ? (rates as UkRates).tradingAllowance * 100 : 0;
  const useTradingAllowance = country !== 'ie' && turnover > 0 && allowableExpenses < tradingAllowance;
  const deductions = useTradingAllowance ? Math.min(tradingAllowance, turnover) : allowableExpenses;
  const profit = turnover - deductions;

  const estimate = estimateTax(profit / 100, Number(settings.otherIncome) || 0, rates);

  // How much of each payment to put aside, based on the effective rate so far
  const setAsidePercent = Math.ceil(estimate.effectiveRate);

  const quarters =
    country === 'ie'
      ? []
      : mtdQuarters(year, settings.mtdQuarters === 'calendar').map((quarter) => {
          // MTD updates are cumulative from the start of the year
          const income = incomeFor(year.start, quarter.end, profile);
          const qExpenses = categoryTotals(ListExpenses(year.start, quarter.end), profile, country);
          const qMileage = mileageAmounts(ListMileage(year.start, quarter.end), country, settings, rates).reduce((sum, t) => sum + t.amount, 0);
          const byHmrc: Record<string, number> = {};
          for (const c of qExpenses.filter((c) => c.allowable && c.hmrc)) byHmrc[c.hmrc] = (byHmrc[c.hmrc] ?? 0) + c.amount;
          byHmrc.travelCosts = (byHmrc.travelCosts ?? 0) + qMileage;
          return { ...quarter, turnover: income.turnover, expenses: byHmrc, totalExpenses: Object.values(byHmrc).reduce((a, b) => a + b, 0) };
        });

  return {
    country,
    year,
    current,
    rates,
    ratesFallback: fallback,
    income: { turnover, invoices, other },
    expenses,
    categories,
    mileage,
    mileageTotal,
    homeOffice,
    allowableExpenses,
    useTradingAllowance,
    deductions,
    profit,
    estimate,
    setAsidePercent,
    quarters,
    deadlines: taxDeadlines(year, country),
    previousYear: previousTaxYear(year, country).label,
  };
}

// ---- VAT ----

// Rolling 12 months of taxable sales against the registration threshold
export function vatThreshold(settings = GetSiteSettings()) {
  const country = taxCountry(settings);
  const today = londonDay(new Date());
  const from = addDays(addMonths(today, -12), 1);
  const { rates } = ratesFor(country, taxYearFor(today, country).label);
  const issued = ListInvoicesBetween(from, today, 'issued').map((row) => invoiceParts(JSON.parse(row.data)));
  const sales = issued.filter((i) => i.code !== 'outside_scope' && i.code !== 'reverse_charge').reduce((sum, i) => sum + i.net, 0) + ListOtherIncome(from, today).reduce((s, i) => s + i.amount, 0);
  const threshold = rates.vat.threshold * 100;
  return { from, to: today, sales, threshold, percent: threshold ? Math.round((sales / threshold) * 100) : 0 };
}

export function vatOverview(settings = GetSiteSettings()) {
  const profile = vatProfile(settings);
  if (!profile.registered) return { profile, periods: [] };
  const today = londonDay(new Date());
  const from = profile.registeredFrom || addMonths(today, -12);
  const submitted = ListVatReturns();
  const periods = vatPeriods(profile.country, (settings.vatQuarterEnds as 'mar' | 'apr' | 'may') || 'mar', from < addMonths(today, -15) ? addMonths(today, -15) : from, today)
    .reverse()
    .map((period) => {
      const by = profile.scheme === 'invoice' ? 'issued' : 'paid';
      const start = profile.registeredFrom && profile.registeredFrom > period.start ? profile.registeredFrom : period.start;
      // Invoices issued before registration carry no VAT and don't belong on a return
      const sales: VatSale[] = ListInvoicesBetween(start, period.end, by)
        .map((row) => invoiceParts(JSON.parse(row.data)))
        .filter((sale) => sale.code !== 'not_registered');
      for (const income of ListOtherIncome(start, period.end)) sales.push({ net: income.amount, vat: income.vat, code: income.vat ? 'standard' : 'outside_scope' });
      const purchases: VatPurchase[] = ListExpenses(start, period.end)
        .filter((e) => e.category !== 'personal')
        .map((e) => {
          const cost = expenseCost(e, profile);
          return { net: cost.net, vat: cost.vatReclaim };
        });
      const filed = submitted.find((r) => r.periodStart === period.start && r.periodEnd === period.end);
      return { ...period, ...vatReturn(profile, sales, purchases), submitted: filed ? { at: filed.submittedAt, reference: filed.reference } : null, open: period.end >= today };
    });
  return { profile, periods };
}

export type { IeRates, UkRates };
