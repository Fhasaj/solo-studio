/*
 * @name: VAT
 * @description: Whether VAT goes on an invoice and at what rate, VAT periods, and VAT return figures for the UK
 * (9-box return) and Ireland (VAT3). Covers services by a UK or Irish freelancer to UK, Irish, EU and other clients.
 * Estimates to file from: check unusual cases (goods, EU consumers, partial exemption) with an accountant.
 * */

import { addDays, addMonths } from './format';
import type { TaxCountry } from './taxRates';

export const CLIENT_COUNTRIES = [
  ['GB', 'United Kingdom'],
  ['IE', 'Ireland'],
  ['EU', 'Another EU country'],
  ['OTHER', 'Outside the UK and EU'],
] as const;
export type ClientCountry = (typeof CLIENT_COUNTRIES)[number][0];

export interface VatTreatment {
  rate: number; // percent; 0 when no VAT is charged
  code: 'standard' | 'reverse_charge' | 'outside_scope' | 'not_registered';
  note: string;
}

export interface VatProfile {
  country: TaxCountry;
  registered: boolean;
  registeredFrom: string; // YYYY-MM-DD or ''
  number: string;
  scheme: 'invoice' | 'cash' | 'flat_rate';
  flatRate: number; // percent, UK Flat Rate Scheme
  standardRate: number;
}

export function isRegisteredOn(profile: VatProfile, day: string) {
  return profile.registered && (!profile.registeredFrom || day >= profile.registeredFrom);
}

// Services are taxed where a business customer is based, so most cross-border work carries no VAT
export function vatTreatment(profile: VatProfile, day: string, client: { country: string; vatNumber: string }): VatTreatment {
  if (!isRegisteredOn(profile, day)) return { rate: 0, code: 'not_registered', note: 'Not registered for VAT, so no VAT is charged.' };
  const home = profile.country === 'ie' ? 'IE' : 'GB';
  const country = (client.country || home) as ClientCountry;

  if (country === home) return { rate: profile.standardRate, code: 'standard', note: '' };
  if (profile.country === 'ie' && country === 'EU') {
    // EU business customers account for the VAT themselves; EU consumers are charged Irish VAT
    return client.vatNumber
      ? { rate: 0, code: 'reverse_charge', note: `Reverse charge: the customer accounts for the VAT (Article 196, Directive 2006/112/EC). Customer VAT number ${client.vatNumber}.` }
      : { rate: profile.standardRate, code: 'standard', note: '' };
  }
  return {
    rate: 0,
    code: 'outside_scope',
    note: `Outside the scope of ${profile.country === 'ie' ? 'Irish' : 'UK'} VAT: services supplied to a customer outside ${profile.country === 'ie' ? 'Ireland' : 'the UK'}.`,
  };
}

export interface VatPeriod {
  start: string;
  end: string;
  due: string;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(day: string) {
  return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

// The VAT periods that overlap a date range: UK quarters on your stagger, Irish two-month periods
export function vatPeriods(country: TaxCountry, quarterEnds: 'mar' | 'apr' | 'may', from: string, to: string): VatPeriod[] {
  const length = country === 'ie' ? 2 : 3;
  // First month of a period: Jan for Ireland (Jan–Feb), else the month after a quarter end
  const offset = country === 'ie' ? 0 : { mar: 0, apr: 1, may: 2 }[quarterEnds];
  const periods: VatPeriod[] = [];
  let year = Number(from.slice(0, 4)) - 1;
  let month = 1 + offset; // 1-based
  while (true) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month + length - 1;
    const end = lastDayOfMonth(year + Math.floor((endMonth - 1) / 12), ((endMonth - 1) % 12) + 1);
    if (start > to) break;
    if (end >= from) {
      // UK: one month and 7 days after the period; Ireland (VAT3 on ROS): the 23rd of the next month
      const due = country === 'ie' ? `${addMonths(end, 1).slice(0, 8)}23` : addDays(addMonths(addDays(end, 1), 1), 6);
      periods.push({ start, end, due, label: `${monthLabel(start)} to ${monthLabel(end)}` });
    }
    month += length;
    if (month > 12) {
      month -= 12;
      year += 1;
    }
  }
  return periods;
}

export interface VatSale {
  net: number; // pence
  vat: number;
  code: VatTreatment['code'];
}

export interface VatPurchase {
  net: number;
  vat: number;
}

export interface VatReturn {
  // UK 9-box return, or the Irish VAT3 fields
  boxes: { key: string; label: string; amount: number }[];
  payable: number; // positive = pay, negative = repayment due
  notes: string[];
}

export function vatReturn(profile: VatProfile, sales: VatSale[], purchases: VatPurchase[]): VatReturn {
  const sum = (items: { net: number; vat: number }[], key: 'net' | 'vat') => items.reduce((total, item) => total + item[key], 0);
  const vatOnSales = sum(sales, 'vat');
  const vatOnPurchases = sum(purchases, 'vat');
  const notes: string[] = [];

  if (profile.country === 'ie') {
    const reverseCharged = sales.filter((s) => s.code === 'reverse_charge');
    const t3 = Math.max(0, vatOnSales - vatOnPurchases);
    const t4 = Math.max(0, vatOnPurchases - vatOnSales);
    return {
      boxes: [
        { key: 'T1', label: 'VAT on sales', amount: vatOnSales },
        { key: 'T2', label: 'VAT on purchases', amount: vatOnPurchases },
        { key: 'T3', label: 'Net VAT payable', amount: t3 },
        { key: 'T4', label: 'Net VAT repayable', amount: t4 },
        { key: 'ES1', label: 'Services supplied to other EU countries (reverse charge)', amount: sum(reverseCharged, 'net') },
        { key: 'ES2', label: 'Services received from other EU countries', amount: 0 },
      ],
      payable: vatOnSales - vatOnPurchases,
      notes: ['File on ROS. Fill in E1, E2 and ES2 yourself if you bought goods or services from other EU countries.'],
    };
  }

  const turnoverNet = sum(sales, 'net');
  let box1 = vatOnSales;
  let box4 = vatOnPurchases;
  if (profile.scheme === 'flat_rate') {
    // Flat Rate Scheme: a fixed percentage of VAT-inclusive turnover; purchase VAT isn't reclaimed (except capital items over £2,000)
    box1 = Math.round(((turnoverNet + vatOnSales) * profile.flatRate) / 100);
    box4 = 0;
    notes.push(`Flat Rate Scheme at ${profile.flatRate}% of VAT-inclusive turnover. Purchase VAT isn't reclaimed, except on single capital items over £2,000.`);
  }
  const box5 = box1 - box4;
  return {
    boxes: [
      { key: '1', label: 'VAT due on sales', amount: box1 },
      { key: '2', label: 'VAT due on acquisitions from the EU (Northern Ireland goods only)', amount: 0 },
      { key: '3', label: 'Total VAT due', amount: box1 },
      { key: '4', label: 'VAT reclaimed on purchases', amount: box4 },
      { key: '5', label: 'Net VAT to pay (or reclaim)', amount: box5 },
      { key: '6', label: 'Total sales, excluding VAT', amount: profile.scheme === 'flat_rate' ? turnoverNet + vatOnSales : turnoverNet },
      { key: '7', label: 'Total purchases, excluding VAT', amount: sum(purchases, 'net') },
      { key: '8', label: 'Goods supplied to the EU (Northern Ireland only)', amount: 0 },
      { key: '9', label: 'Goods acquired from the EU (Northern Ireland only)', amount: 0 },
    ],
    payable: box5,
    notes: [...notes, 'Submit through MTD-compatible software or bridging software; boxes 6 to 9 are in whole pounds.'],
  };
}
