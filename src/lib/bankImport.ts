/*
 * @name: Bank statement import
 * @description: Reads CSV statements from UK and Irish banks (Monzo, Starling, Revolut, Barclays, HSBC, Lloyds, Nationwide,
 * AIB, Bank of Ireland and others) by recognising their column names, and suggests what each line is.
 * */

import { createHash } from 'crypto';

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // pence, money in positive
  importHash: string;
}

// Splits CSV text into rows, handling quoted fields with commas, quotes and line breaks
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';' || c === '\t') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows.map((r) => r.map((cell) => cell.trim()));
}

const DATE_COLUMNS = ['date', 'transaction date', 'posting date', 'completed date', 'started date', 'value date', 'booking date', 'posted transactions date'];
const DESCRIPTION_COLUMNS = ['description', 'details', 'narrative', 'name', 'payee', 'merchant', 'counter party', 'transaction description', 'reference', 'memo'];
const AMOUNT_COLUMNS = ['amount', 'value', 'amount (gbp)', 'amount (eur)', 'transaction amount'];
const IN_COLUMNS = ['paid in', 'money in', 'credit', 'credit amount', 'in', 'deposits'];
const OUT_COLUMNS = ['paid out', 'money out', 'debit', 'debit amount', 'out', 'withdrawals'];

function findColumn(header: string[], names: string[]) {
  const lower = header.map((h) => h.toLowerCase().replace(/\s+/g, ' ').trim());
  for (const name of names) {
    const index = lower.indexOf(name);
    if (index !== -1) return index;
  }
  return -1;
}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

// UK and Irish banks write dates day-first
export function parseDate(value: string) {
  const v = value.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2,4})/.exec(v);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

// "£1,234.56", "-12.30", "(12.30)", "12.30 DR" → pence
export function parseAmount(value: string) {
  let v = value.trim();
  if (!v) return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (/\bDR$/i.test(v)) {
    negative = true;
    v = v.replace(/\s*DR$/i, '');
  }
  v = v.replace(/\s*CR$/i, '').replace(/[£€$,\s]/g, '');
  if (v.startsWith('-')) {
    negative = !negative;
    v = v.slice(1);
  }
  if (v.startsWith('+')) v = v.slice(1);
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const pence = Math.round(Number(v) * 100);
  return negative ? -pence : pence;
}

export function parseStatement(text: string) {
  const rows = parseCsv(text);
  // The header is the first row that names a date column (some banks put account details above it)
  const headerIndex = rows.findIndex((row) => findColumn(row, DATE_COLUMNS) !== -1);
  if (headerIndex === -1) throw new Error("Couldn't find a date column. Export the statement as CSV with column headings.");
  const header = rows[headerIndex];
  const dateCol = findColumn(header, DATE_COLUMNS);
  const descCol = findColumn(header, DESCRIPTION_COLUMNS);
  const amountCol = findColumn(header, AMOUNT_COLUMNS);
  const inCol = findColumn(header, IN_COLUMNS);
  const outCol = findColumn(header, OUT_COLUMNS);
  if (amountCol === -1 && inCol === -1 && outCol === -1) throw new Error("Couldn't find an amount column (Amount, or Paid in / Paid out).");

  const seen = new Map<string, number>();
  const transactions: ParsedTransaction[] = [];
  let skipped = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const date = parseDate(row[dateCol] ?? '');
    let amount: number | null = null;
    if (amountCol !== -1) amount = parseAmount(row[amountCol] ?? '');
    else {
      const paidIn = parseAmount(row[inCol] ?? '') ?? 0;
      const paidOut = parseAmount(row[outCol] ?? '') ?? 0;
      amount = Math.abs(paidIn) - Math.abs(paidOut);
    }
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    const description = (descCol !== -1 ? row[descCol] : row.filter((_, i) => i !== dateCol && i !== amountCol).join(' ')).slice(0, 300) || 'Bank transaction';
    // Two identical lines on the same day are both kept, but re-importing the same file adds nothing
    const base = `${date}|${description}|${amount}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    transactions.push({ date, description, amount, importHash: createHash('sha256').update(`${base}|${occurrence}`).digest('hex') });
  }
  return { transactions, skipped };
}

// A first guess at the expense category from the description; you can always change it
const CATEGORY_HINTS: [RegExp, string][] = [
  [/hetzner|digitalocean|linode|vultr|ovh|ionos|aws|amazon web services|vercel|netlify|cloudflare|heroku|namecheap|godaddy|123-reg|fasthosts/i, 'hosting'],
  [/github|gitlab|jetbrains|google (workspace|gsuite)|microsoft|office 365|adobe|figma|notion|slack|zoom|1password|proton|openai|anthropic|apple\.com\/bill|dropbox/i, 'office'],
  [/\bbt\b|o2|\bee\b|vodafone|three|virgin media|sky broadband|plusnet|eir|vodafone ie/i, 'office'],
  [/trainline|national rail|\btfl\b|uber|bolt|avanti|lner|gwr|ryanair|aer lingus|easyjet|premier inn|travelodge|ncp|ringgo|justpark|parking|irish rail|dublin bus|luas/i, 'travel'],
  [/accountant|accountancy|xero|quickbooks|freeagent|insurance|hiscox|simply business|solicitor|companies house/i, 'professional'],
  [/stripe|paypal|sumup|square|bank charge|account fee|monthly fee/i, 'bank_charges'],
  [/google ads|facebook ads|meta ads|linkedin ads|vistaprint|moo\.com/i, 'advertising'],
  [/udemy|coursera|o'?reilly|pluralsight|waterstones|egghead|frontend masters/i, 'training'],
  [/currys|apple store|dell|lenovo|scan computers|overclockers|argos/i, 'equipment'],
];

export function guessCategory(description: string) {
  return CATEGORY_HINTS.find(([pattern]) => pattern.test(description))?.[1] ?? 'other';
}
