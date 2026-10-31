/*
 * @name: Expense input
 * @description: Checks an expense sent from the admin (the expenses page and bank matching both use it).
 * */

import { EXPENSE_CATEGORIES, type ExpenseInput } from './query/finance.query';
import { readDate, readEnum, readInt, readMoney, readText, ValidationError } from './validate';

export function readExpense(body: Record<string, unknown>): ExpenseInput {
  const amount = readMoney(body.amount, 'amount', { label: 'Amount' });
  const vat = readMoney(body.vat || '0', 'vat', { label: 'VAT' });
  if (amount <= 0) throw new ValidationError('amount', 'Enter the amount paid');
  if (vat > amount) throw new ValidationError('vat', "VAT can't be more than the total");
  return {
    date: readDate(body.date, 'date', { label: 'Date', required: true }),
    supplier: readText(body.supplier, 'supplier', { label: 'Supplier', max: 120 }),
    description: readText(body.description, 'description', { label: 'Description', max: 300 }),
    category: readEnum(body.category, 'category', EXPENSE_CATEGORIES.map((c) => c.key), 'Category'),
    amount,
    vat,
    businessPercent: readInt(body.businessPercent ?? 100, 'businessPercent', { label: 'Business use', min: 0, max: 100 }),
  };
}
