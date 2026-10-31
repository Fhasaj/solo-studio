import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { financeYear, vatOverview } from '@/lib/finance';
import { EXPENSE_CATEGORIES } from '@/lib/query/finance.query';
import { sendApiError, ValidationError } from '@/lib/validate';

const money = (pence: number) => (pence / 100).toFixed(2);

// Quotes cells and stops spreadsheets running anything that looks like a formula
function csv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let text = String(cell);
          if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(',')
    )
    .join('\r\n');
}

// CSV downloads for your accountant or bridging software
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const kind = String(req.query.kind ?? '');
    const yearLabel = typeof req.query.year === 'string' && /^\d{4}(\/\d{2})?$/.test(req.query.year) ? req.query.year : undefined;
    let rows: (string | number)[][];
    let name: string;

    if (kind === 'quarter') {
      // Making Tax Digital: cumulative figures from the start of the tax year to the end of the quarter
      const year = financeYear(yearLabel);
      const quarter = year.quarters.find((q) => q.number === Number(req.query.quarter));
      if (!quarter) throw new ValidationError('quarter', 'Choose quarter 1 to 4 (UK only)');
      rows = [
        ['Field', 'HMRC name', 'Amount'],
        ['Period start', 'periodStartDate', year.year.start],
        ['Period end', 'periodEndDate', quarter.end],
        ['Turnover', 'turnover', money(quarter.turnover)],
        ...Object.entries(quarter.expenses).map(([key, amount]) => [key.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, (c) => c.toUpperCase()), key, money(amount)]),
        ['Total expenses', '', money(quarter.totalExpenses)],
      ];
      name = `mtd-${year.year.label.replace('/', '-')}-q${quarter.number}.csv`;
    } else if (kind === 'transactions') {
      const year = financeYear(yearLabel);
      const label = (key: string) => EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
      rows = [
        ['Date', 'Type', 'Description', 'Category', 'Net', 'VAT', 'Gross', 'Business %'],
        ...year.income.invoices.map((i) => [String(i.paidAt).slice(0, 10), 'Income', `Invoice ${i.number}: ${i.clientName}`, 'Sales', money(i.net), money(i.vat), money(i.net + i.vat), 100]),
        ...year.income.other.map((i) => [i.date, 'Income', i.description, 'Other income', money(i.amount), money(i.vat), money(i.amount + i.vat), 100]),
        ...year.expenses.map((e) => [e.date, 'Expense', [e.supplier, e.description].filter(Boolean).join(': '), label(e.category), money(e.amount - e.vat), money(e.vat), money(e.amount), e.businessPercent]),
        ...year.mileage.map((t) => [t.date, 'Mileage', `${t.purpose}${t.route ? ` (${t.route})` : ''}: ${t.distance} ${year.country === 'ie' ? 'km' : 'miles'}`, 'Travel', money(t.amount), '0.00', money(t.amount), 100]),
      ].sort((a, b) => (a[0] === 'Date' ? -1 : b[0] === 'Date' ? 1 : String(a[0]).localeCompare(String(b[0]))));
      name = `transactions-${year.year.label.replace('/', '-')}.csv`;
    } else if (kind === 'vat') {
      const period = vatOverview().periods.find((p) => p.start === req.query.start && p.end === req.query.end);
      if (!period) throw new ValidationError('start', 'That VAT period was not found');
      rows = [['Box', 'Description', 'Amount'], ...period.boxes.map((box) => [box.key, box.label, money(box.amount)])];
      name = `vat-${period.start}-to-${period.end}.csv`;
    } else {
      throw new ValidationError('kind', 'Choose quarter, transactions or vat');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send('﻿' + csv(rows));
  } catch (err) {
    return sendApiError(res, err);
  }
}
