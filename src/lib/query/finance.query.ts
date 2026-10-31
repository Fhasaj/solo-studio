import { getDb } from '../dbConnect';
import { runMigrations } from '../migrate';
import { sqliteToIso } from '../format';
// Clients, invoices and payments live in the same database and must exist first
import './clients.query';

const db = getDb('clients');

runMigrations(db, [
  {
    id: '2026-11-01-bookkeeping',
    up: (db) => {
      db.exec(`
        CREATE TABLE expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL, -- YYYY-MM-DD, when it was paid
          supplier TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL,
          amount INTEGER NOT NULL, -- pence, total paid including VAT
          vat INTEGER NOT NULL DEFAULT 0, -- pence, reclaimable VAT within amount
          businessPercent INTEGER NOT NULL DEFAULT 100,
          receiptStoredName TEXT,
          receiptName TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX expenses_date ON expenses (date);

        CREATE TABLE mileage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          purpose TEXT NOT NULL,
          route TEXT NOT NULL DEFAULT '',
          distance REAL NOT NULL, -- miles (UK) or km (Ireland)
          vehicle TEXT NOT NULL DEFAULT 'car' CHECK (vehicle IN ('car', 'motorcycle', 'bicycle')),
          amount INTEGER NOT NULL, -- pence, worked out when saved
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX mileage_date ON mileage (date);

        -- Income received outside invoices in this system
        CREATE TABLE other_income (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL, -- pence, excluding VAT
          vat INTEGER NOT NULL DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE bank_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL, -- pence; money in is positive, money out negative
          importHash TEXT NOT NULL UNIQUE, -- stops the same line being imported twice
          status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'matched', 'ignored')),
          matchType TEXT, -- invoice, expense, income, transfer, personal
          matchId INTEGER,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX bank_transactions_date ON bank_transactions (date);

        CREATE TABLE vat_returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          periodStart TEXT NOT NULL,
          periodEnd TEXT NOT NULL,
          boxes TEXT NOT NULL, -- JSON snapshot of the figures filed
          submittedAt TEXT NOT NULL,
          reference TEXT NOT NULL DEFAULT '',
          UNIQUE (periodStart, periodEnd)
        );

        -- Your own corrections to the built-in tax rates for a year
        CREATE TABLE tax_rate_overrides (
          country TEXT NOT NULL,
          year TEXT NOT NULL,
          data TEXT NOT NULL,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (country, year)
        );
      `);
    },
  },
]);

type Row = Record<string, unknown>;

// ---- Expense categories (shared with the browser, so they live in their own file) ----

import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../expenseCategories';
export { EXPENSE_CATEGORIES, type ExpenseCategory };

// ---- Expenses ----

export interface Expense {
  id: number;
  date: string;
  supplier: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  vat: number;
  businessPercent: number;
  receiptStoredName: string | null;
  receiptName: string | null;
  createdAt: string | null;
}

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'receiptStoredName' | 'receiptName'>;

const toExpense = (row: Row) => ({ ...row, createdAt: sqliteToIso(row.createdAt as string) }) as Expense;

export function ListExpenses(from: string, to: string) {
  return (db.prepare('SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC').all(from, to) as Row[]).map(toExpense);
}

export function GetExpense(id: number) {
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Row | undefined;
  return row ? toExpense(row) : null;
}

export function InsertExpense(input: ExpenseInput) {
  const info = db
    .prepare('INSERT INTO expenses (date, supplier, description, category, amount, vat, businessPercent) VALUES (@date, @supplier, @description, @category, @amount, @vat, @businessPercent)')
    .run(input);
  return Number(info.lastInsertRowid);
}

export function UpdateExpense(id: number, input: ExpenseInput) {
  return db
    .prepare('UPDATE expenses SET date = @date, supplier = @supplier, description = @description, category = @category, amount = @amount, vat = @vat, businessPercent = @businessPercent WHERE id = @id')
    .run({ ...input, id }).changes;
}

export function SetExpenseReceipt(id: number, storedName: string | null, name: string | null) {
  return db.prepare('UPDATE expenses SET receiptStoredName = ?, receiptName = ? WHERE id = ?').run(storedName, name, id).changes;
}

export function DeleteExpense(id: number) {
  return db.transaction(() => {
    db.prepare("UPDATE bank_transactions SET status = 'new', matchType = NULL, matchId = NULL WHERE matchType = 'expense' AND matchId = ?").run(id);
    return db.prepare('DELETE FROM expenses WHERE id = ?').run(id).changes;
  })();
}

// ---- Mileage ----

export interface MileageTrip {
  id: number;
  date: string;
  purpose: string;
  route: string;
  distance: number;
  vehicle: 'car' | 'motorcycle' | 'bicycle';
  amount: number;
  createdAt: string | null;
}

export function ListMileage(from: string, to: string) {
  return (db.prepare('SELECT * FROM mileage WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC').all(from, to) as Row[]).map(
    (row) => ({ ...row, createdAt: sqliteToIso(row.createdAt as string) }) as MileageTrip
  );
}

export function InsertMileage(trip: Omit<MileageTrip, 'id' | 'createdAt'>) {
  const info = db.prepare('INSERT INTO mileage (date, purpose, route, distance, vehicle, amount) VALUES (@date, @purpose, @route, @distance, @vehicle, @amount)').run(trip);
  return Number(info.lastInsertRowid);
}

export function DeleteMileage(id: number) {
  return db.prepare('DELETE FROM mileage WHERE id = ?').run(id).changes;
}

// ---- Other income ----

export interface OtherIncome {
  id: number;
  date: string;
  description: string;
  amount: number;
  vat: number;
  createdAt: string | null;
}

export function ListOtherIncome(from: string, to: string) {
  return (db.prepare('SELECT * FROM other_income WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC').all(from, to) as Row[]).map(
    (row) => ({ ...row, createdAt: sqliteToIso(row.createdAt as string) }) as OtherIncome
  );
}

export function InsertOtherIncome(income: Omit<OtherIncome, 'id' | 'createdAt'>) {
  const info = db.prepare('INSERT INTO other_income (date, description, amount, vat) VALUES (@date, @description, @amount, @vat)').run(income);
  return Number(info.lastInsertRowid);
}

export function DeleteOtherIncome(id: number) {
  return db.transaction(() => {
    db.prepare("UPDATE bank_transactions SET status = 'new', matchType = NULL, matchId = NULL WHERE matchType = 'income' AND matchId = ?").run(id);
    return db.prepare('DELETE FROM other_income WHERE id = ?').run(id).changes;
  })();
}

// ---- Paid invoices (income) ----

export interface PaidInvoiceRow {
  id: number;
  number: string;
  paidAt: string;
  total: number;
  data: string;
  clientName: string;
}

// Invoices paid between two days (cash basis), or issued between them (for VAT on the invoice basis)
export function ListInvoicesBetween(from: string, to: string, by: 'paid' | 'issued') {
  const sql =
    by === 'paid'
      ? "SELECT i.id, i.number, i.paidAt, i.issuedAt, i.total, i.data, i.status, c.name AS clientName FROM invoices i JOIN projects p ON p.id = i.projectId JOIN clients c ON c.id = p.clientId WHERE i.status = 'paid' AND substr(i.paidAt, 1, 10) >= ? AND substr(i.paidAt, 1, 10) <= ? ORDER BY i.paidAt"
      : "SELECT i.id, i.number, i.paidAt, i.issuedAt, i.total, i.data, i.status, c.name AS clientName FROM invoices i JOIN projects p ON p.id = i.projectId JOIN clients c ON c.id = p.clientId WHERE i.status != 'void' AND i.issuedAt >= ? AND i.issuedAt <= ? ORDER BY i.issuedAt";
  return db.prepare(sql).all(from, to) as (PaidInvoiceRow & { issuedAt: string; status: string })[];
}

export function ListUnpaidInvoices() {
  return db
    .prepare("SELECT i.id, i.number, i.total, i.data, i.kind, i.milestoneId, i.projectId, c.name AS clientName FROM invoices i JOIN projects p ON p.id = i.projectId JOIN clients c ON c.id = p.clientId WHERE i.status = 'unpaid' ORDER BY i.issuedAt")
    .all() as { id: number; number: string; total: number; data: string; kind: string; milestoneId: number | null; projectId: number; clientName: string }[];
}

// ---- Bank transactions ----

export interface BankTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  status: 'new' | 'matched' | 'ignored';
  matchType: string | null;
  matchId: number | null;
}

export function InsertBankTransactions(rows: { date: string; description: string; amount: number; importHash: string }[]) {
  const insert = db.prepare('INSERT OR IGNORE INTO bank_transactions (date, description, amount, importHash) VALUES (@date, @description, @amount, @importHash)');
  return db.transaction(() => rows.reduce((added, row) => added + insert.run(row).changes, 0))();
}

export function ListBankTransactions(status: 'new' | 'all') {
  const where = status === 'new' ? "WHERE status = 'new'" : '';
  return db.prepare(`SELECT id, date, description, amount, status, matchType, matchId FROM bank_transactions ${where} ORDER BY date DESC, id DESC LIMIT 500`).all() as BankTransaction[];
}

export function GetBankTransaction(id: number) {
  return db.prepare('SELECT id, date, description, amount, status, matchType, matchId FROM bank_transactions WHERE id = ?').get(id) as BankTransaction | undefined;
}

export function SetBankTransactionMatch(id: number, status: BankTransaction['status'], matchType: string | null, matchId: number | null) {
  return db.prepare('UPDATE bank_transactions SET status = ?, matchType = ?, matchId = ? WHERE id = ?').run(status, matchType, matchId, id).changes;
}

// ---- VAT returns ----

export function ListVatReturns() {
  return db.prepare('SELECT * FROM vat_returns ORDER BY periodStart DESC').all() as { id: number; periodStart: string; periodEnd: string; boxes: string; submittedAt: string; reference: string }[];
}

export function InsertVatReturn(periodStart: string, periodEnd: string, boxes: unknown, reference: string) {
  return db
    .prepare('INSERT INTO vat_returns (periodStart, periodEnd, boxes, submittedAt, reference) VALUES (?, ?, ?, ?, ?)')
    .run(periodStart, periodEnd, JSON.stringify(boxes), new Date().toISOString(), reference).changes;
}

export function DeleteVatReturn(periodStart: string, periodEnd: string) {
  return db.prepare('DELETE FROM vat_returns WHERE periodStart = ? AND periodEnd = ?').run(periodStart, periodEnd).changes;
}

// ---- Tax rate overrides ----

export function GetTaxRateOverride(country: string, year: string) {
  const row = db.prepare('SELECT data FROM tax_rate_overrides WHERE country = ? AND year = ?').get(country, year) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function SaveTaxRateOverride(country: string, year: string, data: unknown) {
  db.prepare(
    `INSERT INTO tax_rate_overrides (country, year, data) VALUES (?, ?, ?)
     ON CONFLICT(country, year) DO UPDATE SET data = excluded.data, updatedAt = CURRENT_TIMESTAMP`
  ).run(country, year, JSON.stringify(data));
}

export function DeleteTaxRateOverride(country: string, year: string) {
  return db.prepare('DELETE FROM tax_rate_overrides WHERE country = ? AND year = ?').run(country, year).changes;
}
