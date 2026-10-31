import { getDb } from '../dbConnect';
import { runMigrations } from '../migrate';
import { sqliteToIso } from '../format';

const db = getDb('clients');

runMigrations(db, [
  {
    id: '2026-10-30-client-portal',
    up: (db) => {
      db.exec(`
        CREATE TABLE clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          company TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- One-time sign-in links. Only a hash of the token is stored.
        CREATE TABLE login_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clientId INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          tokenHash TEXT NOT NULL UNIQUE,
          expiresAt TEXT NOT NULL,
          usedAt TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clientId INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
          reference TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
          totalPrice INTEGER NOT NULL DEFAULT 0, -- pence
          supportMonths INTEGER NOT NULL DEFAULT 6,
          completedAt TEXT, -- YYYY-MM-DD
          supportExtendedUntil TEXT, -- YYYY-MM-DD
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          amount INTEGER NOT NULL DEFAULT 0, -- pence
          requiresPayment INTEGER NOT NULL DEFAULT 0,
          dueDate TEXT, -- YYYY-MM-DD
          status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'awaiting_payment', 'complete')),
          paymentRequestedAt TEXT,
          paymentReportedAt TEXT,
          paidAt TEXT,
          sortOrder INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX milestones_project ON milestones (projectId, sortOrder);

        CREATE TABLE project_updates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          body TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- body is frozen once sent; bodyHash proves which exact text was signed
        CREATE TABLE contracts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'void')),
          bodyHash TEXT,
          providerName TEXT,
          sentAt TEXT,
          signedAt TEXT,
          signedName TEXT,
          signedIp TEXT,
          signedUserAgent TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE support_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          plan TEXT NOT NULL CHECK (plan IN ('standard', 'priority')),
          months INTEGER NOT NULL,
          message TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled')),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    // Optional paid hosting per project: a monthly fee (pence, 0 = the client hosts it) and how far it's paid up
    id: '2026-10-30-project-hosting',
    up: (db) => {
      db.exec(`
        ALTER TABLE projects ADD COLUMN hostingMonthly INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE projects ADD COLUMN hostingPaidUntil TEXT; -- YYYY-MM-DD
      `);
    },
  },
  {
    // The running costs behind the hosting fee (JSON list of { label, amount (pence), period }).
    // hostingMonthly stays as the fee the client pays: these costs plus the markup, worked out when saved.
    id: '2026-10-31-hosting-costs',
    up: (db) => {
      db.exec(`ALTER TABLE projects ADD COLUMN hostingCosts TEXT NOT NULL DEFAULT '[]';`);
    },
  },
  {
    // How each job is paid: 'before' = each stage is paid before it starts, 'after' = paid when done, before the next starts.
    // Existing jobs keep 'after' (how they worked until now); new jobs default to 'before'.
    id: '2026-10-31-payment-options',
    up: (db) => {
      db.exec(`
        ALTER TABLE projects ADD COLUMN paymentTiming TEXT NOT NULL DEFAULT 'after' CHECK (paymentTiming IN ('before', 'after'));
        ALTER TABLE projects ADD COLUMN allowCard INTEGER NOT NULL DEFAULT 0;

        CREATE TABLE payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          milestoneId INTEGER NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          method TEXT NOT NULL CHECK (method IN ('bank', 'card')),
          amount INTEGER NOT NULL, -- pence, the milestone amount
          fee INTEGER NOT NULL DEFAULT 0, -- pence, card fee paid by the client on top
          reference TEXT UNIQUE, -- Stripe Checkout session id for card payments
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    // Invoices (numbered, frozen once issued) and the final code handover
    id: '2026-10-31-invoices-handover',
    up: (db) => {
      db.exec(`
        ALTER TABLE clients ADD COLUMN address TEXT NOT NULL DEFAULT '';
        ALTER TABLE projects ADD COLUMN handoverNotes TEXT NOT NULL DEFAULT '';
        ALTER TABLE projects ADD COLUMN handoverRepoUrl TEXT NOT NULL DEFAULT '';

        CREATE TABLE invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          number TEXT NOT NULL UNIQUE, -- INV-2026-0001, never reused
          projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
          milestoneId INTEGER REFERENCES milestones(id) ON DELETE RESTRICT,
          kind TEXT NOT NULL CHECK (kind IN ('milestone', 'hosting')),
          months INTEGER, -- hosting invoices: months covered
          status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'void')),
          total INTEGER NOT NULL, -- pence
          data TEXT NOT NULL, -- JSON snapshot: seller, buyer, lines, dates
          issuedAt TEXT NOT NULL,
          dueAt TEXT NOT NULL,
          paidAt TEXT
        );
        CREATE INDEX invoices_project ON invoices (projectId);

        CREATE TABLE handover_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
          fileName TEXT NOT NULL,
          storedName TEXT NOT NULL UNIQUE,
          size INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE handover_downloads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fileId INTEGER NOT NULL REFERENCES handover_files(id) ON DELETE CASCADE,
          clientId INTEGER NOT NULL,
          ip TEXT NOT NULL,
          downloadedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
]);

// ---- Types ----

export const PROJECT_STATUSES = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const MILESTONE_STATUSES = ['upcoming', 'in_progress', 'awaiting_payment', 'complete'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'void';
export const SUPPORT_PLANS = ['standard', 'priority'] as const;
export type SupportPlan = (typeof SUPPORT_PLANS)[number];

export interface Client {
  id: number;
  name: string;
  email: string;
  company: string;
  phone: string;
  address: string;
  notes: string;
  isActive: boolean;
  createdAt: string | null;
}

export interface HostingCost {
  label: string;
  amount: number; // pence
  period: 'month' | 'year';
}

export interface Project {
  id: number;
  clientId: number;
  reference: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  totalPrice: number;
  supportMonths: number;
  completedAt: string | null;
  supportExtendedUntil: string | null;
  hostingMonthly: number;
  hostingPaidUntil: string | null;
  hostingCosts: HostingCost[];
  paymentTiming: PaymentTiming;
  allowCard: boolean;
  handoverNotes: string;
  handoverRepoUrl: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export const PAYMENT_TIMINGS = ['before', 'after'] as const;
export type PaymentTiming = (typeof PAYMENT_TIMINGS)[number];

export interface Payment {
  id: number;
  milestoneId: number;
  method: 'bank' | 'card';
  amount: number;
  fee: number;
  reference: string | null;
  createdAt: string | null;
}

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  description: string;
  amount: number;
  requiresPayment: boolean;
  dueDate: string | null;
  status: MilestoneStatus;
  paymentRequestedAt: string | null;
  paymentReportedAt: string | null;
  paidAt: string | null;
  sortOrder: number;
}

export interface ProjectUpdate {
  id: number;
  projectId: number;
  body: string;
  createdAt: string | null;
}

export interface Contract {
  id: number;
  projectId: number;
  title: string;
  body: string;
  status: ContractStatus;
  bodyHash: string | null;
  providerName: string | null;
  sentAt: string | null;
  signedAt: string | null;
  signedName: string | null;
  signedIp: string | null;
  signedUserAgent: string | null;
  createdAt: string | null;
}

export interface SupportRequest {
  id: number;
  projectId: number;
  plan: SupportPlan;
  months: number;
  message: string;
  status: 'new' | 'handled';
  createdAt: string | null;
}

type Row = Record<string, unknown>;

const toClient = (row: Row) => ({ ...row, isActive: row.isActive === 1, createdAt: sqliteToIso(row.createdAt as string) }) as Client;
function parseCosts(value: unknown): HostingCost[] {
  try {
    const costs = JSON.parse(String(value ?? '[]'));
    return Array.isArray(costs) ? costs : [];
  } catch {
    return [];
  }
}

const toProject = (row: Row) =>
  ({
    ...row,
    hostingCosts: parseCosts(row.hostingCosts),
    allowCard: row.allowCard === 1,
    createdAt: sqliteToIso(row.createdAt as string),
    updatedAt: sqliteToIso(row.updatedAt as string),
  }) as Project;
const toMilestone = (row: Row) => ({ ...row, requiresPayment: row.requiresPayment === 1 }) as Milestone;
const withCreatedAt = <T,>(row: Row) => ({ ...row, createdAt: sqliteToIso(row.createdAt as string) }) as T;

// ---- Clients ----

export function ListClients() {
  return (db.prepare('SELECT * FROM clients ORDER BY isActive DESC, name').all() as Row[]).map(toClient);
}

export function GetClient(id: number) {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Row | undefined;
  return row ? toClient(row) : null;
}

export function GetClientByEmail(email: string) {
  const row = db.prepare('SELECT * FROM clients WHERE email = ?').get(email) as Row | undefined;
  return row ? toClient(row) : null;
}

export type ClientInput = Pick<Client, 'name' | 'email' | 'company' | 'phone' | 'address' | 'notes' | 'isActive'>;

export function InsertClient(input: ClientInput) {
  const info = db
    .prepare('INSERT INTO clients (name, email, company, phone, address, notes, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(input.name, input.email, input.company, input.phone, input.address, input.notes, input.isActive ? 1 : 0);
  return Number(info.lastInsertRowid);
}

export function UpdateClient(id: number, input: ClientInput) {
  return db
    .prepare('UPDATE clients SET name = ?, email = ?, company = ?, phone = ?, address = ?, notes = ?, isActive = ? WHERE id = ?')
    .run(input.name, input.email, input.company, input.phone, input.address, input.notes, input.isActive ? 1 : 0, id).changes;
}

export function DeleteClient(id: number) {
  return db.prepare('DELETE FROM clients WHERE id = ?').run(id).changes;
}

export function ClientHasProjects(id: number) {
  return Boolean(db.prepare('SELECT 1 FROM projects WHERE clientId = ?').get(id));
}

// ---- Login tokens ----

export function InsertLoginToken(clientId: number, tokenHash: string, expiresAt: string) {
  db.prepare("DELETE FROM login_tokens WHERE expiresAt < ? OR usedAt IS NOT NULL").run(new Date().toISOString());
  db.prepare('INSERT INTO login_tokens (clientId, tokenHash, expiresAt) VALUES (?, ?, ?)').run(clientId, tokenHash, expiresAt);
}

// Marks a valid token used and returns its client id. A token works once.
export function ConsumeLoginToken(tokenHash: string) {
  return db.transaction(() => {
    const row = db
      .prepare('SELECT id, clientId FROM login_tokens WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?')
      .get(tokenHash, new Date().toISOString()) as { id: number; clientId: number } | undefined;
    if (!row) return null;
    db.prepare('UPDATE login_tokens SET usedAt = ? WHERE id = ?').run(new Date().toISOString(), row.id);
    return row.clientId;
  }).immediate();
}

// ---- Projects ----

export interface ProjectListItem extends Project {
  clientName: string;
  clientCompany: string;
}

export function ListProjects(clientId?: number) {
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS clientName, c.company AS clientCompany FROM projects p JOIN clients c ON c.id = p.clientId
       ${clientId ? 'WHERE p.clientId = ?' : ''} ORDER BY p.status = 'completed', p.status = 'cancelled', p.updatedAt DESC`
    )
    .all(...(clientId ? [clientId] : [])) as Row[];
  return rows.map((row) => toProject(row) as ProjectListItem);
}

export function GetProject(id: number) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
  return row ? toProject(row) : null;
}

// Only returns the project if it belongs to this client
export function GetClientProject(id: number, clientId: number) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND clientId = ?').get(id, clientId) as Row | undefined;
  return row ? toProject(row) : null;
}

export type ProjectInput = Pick<
  Project,
  | 'title'
  | 'summary'
  | 'status'
  | 'totalPrice'
  | 'supportMonths'
  | 'completedAt'
  | 'supportExtendedUntil'
  | 'hostingMonthly'
  | 'hostingPaidUntil'
  | 'hostingCosts'
  | 'paymentTiming'
  | 'allowCard'
>;

function projectParams(input: ProjectInput) {
  return { ...input, hostingCosts: JSON.stringify(input.hostingCosts), allowCard: input.allowCard ? 1 : 0 };
}

export function InsertProject(clientId: number, input: ProjectInput) {
  return db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO projects (clientId, reference, title, summary, status, totalPrice, supportMonths, completedAt, supportExtendedUntil,
           hostingMonthly, hostingPaidUntil, hostingCosts, paymentTiming, allowCard)
         VALUES (@clientId, @reference, @title, @summary, @status, @totalPrice, @supportMonths, @completedAt, @supportExtendedUntil,
           @hostingMonthly, @hostingPaidUntil, @hostingCosts, @paymentTiming, @allowCard)`
      )
      .run({ ...projectParams(input), clientId, reference: `pending-${Date.now()}-${Math.random()}` });
    const id = Number(info.lastInsertRowid);
    // Short, typeable reference used on invoices and bank transfers, e.g. FH-2026-007
    db.prepare('UPDATE projects SET reference = ? WHERE id = ?').run(`FH-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`, id);
    return id;
  })();
}

export function UpdateProject(id: number, input: ProjectInput) {
  return db
    .prepare(
      `UPDATE projects SET title = @title, summary = @summary, status = @status, totalPrice = @totalPrice, supportMonths = @supportMonths,
         completedAt = @completedAt, supportExtendedUntil = @supportExtendedUntil, hostingMonthly = @hostingMonthly,
         hostingPaidUntil = @hostingPaidUntil, hostingCosts = @hostingCosts, paymentTiming = @paymentTiming, allowCard = @allowCard,
         updatedAt = CURRENT_TIMESTAMP WHERE id = @id`
    )
    .run({ ...projectParams(input), id }).changes;
}

export function TouchProject(id: number) {
  db.prepare('UPDATE projects SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

export function DeleteProject(id: number) {
  return db.transaction(() => {
    // Signed contracts and payments are records you may need later, so they block deletion
    if (db.prepare("SELECT 1 FROM contracts WHERE projectId = ? AND status = 'signed'").get(id)) return -1;
    if (db.prepare('SELECT 1 FROM payments p JOIN milestones m ON m.id = p.milestoneId WHERE m.projectId = ?').get(id)) return -1;
    if (db.prepare("SELECT 1 FROM invoices WHERE projectId = ? AND status != 'void'").get(id)) return -1;
    if (db.prepare('SELECT 1 FROM handover_files WHERE projectId = ?').get(id)) return -1;
    db.prepare('DELETE FROM invoices WHERE projectId = ?').run(id);
    db.prepare('DELETE FROM contracts WHERE projectId = ?').run(id);
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes;
  })();
}

// ---- Milestones ----

export function ListMilestones(projectId: number) {
  return (db.prepare('SELECT * FROM milestones WHERE projectId = ? ORDER BY sortOrder, id').all(projectId) as Row[]).map(toMilestone);
}

export function GetMilestone(id: number) {
  const row = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as Row | undefined;
  return row ? toMilestone(row) : null;
}

export type MilestoneInput = Pick<Milestone, 'title' | 'description' | 'amount' | 'requiresPayment' | 'dueDate'>;

export function InsertMilestone(projectId: number, input: MilestoneInput) {
  const { next } = db.prepare('SELECT COALESCE(MAX(sortOrder), -1) + 1 AS next FROM milestones WHERE projectId = ?').get(projectId) as { next: number };
  const info = db
    .prepare('INSERT INTO milestones (projectId, title, description, amount, requiresPayment, dueDate, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, input.title, input.description, input.amount, input.requiresPayment ? 1 : 0, input.dueDate, next);
  TouchProject(projectId);
  return Number(info.lastInsertRowid);
}

export function UpdateMilestone(id: number, input: MilestoneInput) {
  return db
    .prepare('UPDATE milestones SET title = ?, description = ?, amount = ?, requiresPayment = ?, dueDate = ? WHERE id = ?')
    .run(input.title, input.description, input.amount, input.requiresPayment ? 1 : 0, input.dueDate, id).changes;
}

export function SetMilestoneStatus(id: number, status: MilestoneStatus, extra: Partial<Pick<Milestone, 'paymentRequestedAt' | 'paidAt' | 'paymentReportedAt'>> = {}) {
  const sets = ['status = @status', ...Object.keys(extra).map((key) => `${key} = @${key}`)];
  return db.prepare(`UPDATE milestones SET ${sets.join(', ')} WHERE id = @id`).run({ id, status, ...extra }).changes;
}

export function ReportMilestonePayment(id: number) {
  return db.prepare('UPDATE milestones SET paymentReportedAt = ? WHERE id = ? AND paidAt IS NULL').run(new Date().toISOString(), id).changes;
}

export function DeleteMilestone(id: number) {
  return db.prepare('DELETE FROM milestones WHERE id = ?').run(id).changes;
}

export function MoveMilestone(id: number, direction: 'up' | 'down') {
  const milestone = GetMilestone(id);
  if (!milestone) return 0;
  const rows = db.prepare('SELECT id FROM milestones WHERE projectId = ? ORDER BY sortOrder, id').all(milestone.projectId) as { id: number }[];
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= rows.length) return 0;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  const update = db.prepare('UPDATE milestones SET sortOrder = ? WHERE id = ?');
  db.transaction(() => rows.forEach((row, order) => update.run(order, row.id)))();
  return 1;
}

// ---- Updates ----

export function ListUpdates(projectId: number) {
  return (db.prepare('SELECT * FROM project_updates WHERE projectId = ? ORDER BY createdAt DESC, id DESC').all(projectId) as Row[]).map(
    (row) => withCreatedAt<ProjectUpdate>(row)
  );
}

export function InsertUpdate(projectId: number, body: string) {
  const info = db.prepare('INSERT INTO project_updates (projectId, body) VALUES (?, ?)').run(projectId, body);
  TouchProject(projectId);
  return Number(info.lastInsertRowid);
}

export function DeleteUpdate(id: number) {
  return db.prepare('DELETE FROM project_updates WHERE id = ?').run(id).changes;
}

// ---- Contracts ----

export function ListContracts(projectId: number) {
  return (db.prepare('SELECT * FROM contracts WHERE projectId = ? ORDER BY id DESC').all(projectId) as Row[]).map((row) => withCreatedAt<Contract>(row));
}

export function GetContract(id: number) {
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as Row | undefined;
  return row ? withCreatedAt<Contract>(row) : null;
}

export function HasSignedContract(projectId: number) {
  return Boolean(db.prepare("SELECT 1 FROM contracts WHERE projectId = ? AND status = 'signed'").get(projectId));
}

export function InsertContract(projectId: number, title: string, body: string) {
  const info = db.prepare('INSERT INTO contracts (projectId, title, body) VALUES (?, ?, ?)').run(projectId, title, body);
  return Number(info.lastInsertRowid);
}

// Drafts only: once sent, the text can't change
export function UpdateDraftContract(id: number, title: string, body: string) {
  return db.prepare("UPDATE contracts SET title = ?, body = ? WHERE id = ? AND status = 'draft'").run(title, body, id).changes;
}

export function MarkContractSent(id: number, bodyHash: string, providerName: string) {
  return db
    .prepare("UPDATE contracts SET status = 'sent', bodyHash = ?, providerName = ?, sentAt = ? WHERE id = ? AND status = 'draft'")
    .run(bodyHash, providerName, new Date().toISOString(), id).changes;
}

export function MarkContractSigned(id: number, bodyHash: string, signature: { name: string; ip: string; userAgent: string }) {
  return db
    .prepare(
      `UPDATE contracts SET status = 'signed', signedAt = ?, signedName = ?, signedIp = ?, signedUserAgent = ?
       WHERE id = ? AND status = 'sent' AND bodyHash = ?`
    )
    .run(new Date().toISOString(), signature.name, signature.ip, signature.userAgent, id, bodyHash).changes;
}

export function VoidContract(id: number) {
  return db.prepare("UPDATE contracts SET status = 'void' WHERE id = ? AND status IN ('draft', 'sent')").run(id).changes;
}

export function DeleteDraftContract(id: number) {
  return db.prepare("DELETE FROM contracts WHERE id = ? AND status = 'draft'").run(id).changes;
}

// ---- Payments ----

export function ListPayments(projectId: number) {
  return (
    db
      .prepare('SELECT p.* FROM payments p JOIN milestones m ON m.id = p.milestoneId WHERE m.projectId = ? ORDER BY p.id')
      .all(projectId) as Row[]
  ).map((row) => withCreatedAt<Payment>(row));
}

// Records a payment and marks the milestone paid, once. Returns false if this reference was already recorded.
export function InsertPayment(payment: Omit<Payment, 'id' | 'createdAt'>, nextStatus: MilestoneStatus) {
  return db.transaction(() => {
    if (payment.reference && db.prepare('SELECT 1 FROM payments WHERE reference = ?').get(payment.reference)) return false;
    db.prepare('INSERT INTO payments (milestoneId, method, amount, fee, reference) VALUES (?, ?, ?, ?, ?)').run(
      payment.milestoneId,
      payment.method,
      payment.amount,
      payment.fee,
      payment.reference
    );
    db.prepare('UPDATE milestones SET status = ?, paidAt = ? WHERE id = ? AND paidAt IS NULL').run(nextStatus, new Date().toISOString(), payment.milestoneId);
    return true;
  }).immediate();
}

// ---- Support requests ----

export function ListSupportRequests(projectId: number) {
  return (db.prepare('SELECT * FROM support_requests WHERE projectId = ? ORDER BY id DESC').all(projectId) as Row[]).map((row) =>
    withCreatedAt<SupportRequest>(row)
  );
}

export function InsertSupportRequest(projectId: number, plan: SupportPlan, months: number, message: string) {
  const info = db.prepare('INSERT INTO support_requests (projectId, plan, months, message) VALUES (?, ?, ?, ?)').run(projectId, plan, months, message);
  return Number(info.lastInsertRowid);
}

export function MarkSupportRequestHandled(id: number) {
  return db.prepare("UPDATE support_requests SET status = 'handled' WHERE id = ?").run(id).changes;
}

export function GetSupportRequest(id: number) {
  const row = db.prepare('SELECT * FROM support_requests WHERE id = ?').get(id) as Row | undefined;
  return row ? withCreatedAt<SupportRequest>(row) : null;
}

// Milestones of live projects, with their project and client, for the admin work board
export function ListActiveMilestones() {
  return db
    .prepare(
      `SELECT m.*, p.title AS projectTitle, p.reference AS projectReference, p.paymentTiming, c.name AS clientName, c.company AS clientCompany
       FROM milestones m JOIN projects p ON p.id = m.projectId JOIN clients c ON c.id = p.clientId
       WHERE p.status IN ('planning', 'in_progress', 'on_hold', 'completed') ORDER BY p.id, m.sortOrder, m.id`
    )
    .all() as Array<Row & { projectTitle: string; projectReference: string; paymentTiming: PaymentTiming; clientName: string; clientCompany: string }>;
}

export function ListContractsAwaitingSignature() {
  return db
    .prepare(
      `SELECT ct.id, ct.projectId, ct.sentAt, p.title AS projectTitle, c.name AS clientName FROM contracts ct
       JOIN projects p ON p.id = ct.projectId JOIN clients c ON c.id = p.clientId WHERE ct.status = 'sent' ORDER BY ct.sentAt`
    )
    .all() as { id: number; projectId: number; sentAt: string; projectTitle: string; clientName: string }[];
}

// Hosted projects whose hosting is unpaid or runs out before `before` (YYYY-MM-DD)
export function ListHostingDue(before: string) {
  return db
    .prepare(
      `SELECT p.id, p.title, p.hostingMonthly, p.hostingPaidUntil, c.name AS clientName FROM projects p JOIN clients c ON c.id = p.clientId
       WHERE p.hostingMonthly > 0 AND p.status != 'cancelled' AND (p.hostingPaidUntil IS NULL OR p.hostingPaidUntil < ?)
       ORDER BY p.hostingPaidUntil`
    )
    .all(before) as { id: number; title: string; hostingMonthly: number; hostingPaidUntil: string | null; clientName: string }[];
}

export function CountOpenWork() {
  return db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM projects WHERE status IN ('planning', 'in_progress', 'on_hold')) AS activeProjects,
         (SELECT COUNT(*) FROM milestones m JOIN projects p ON p.id = m.projectId
            WHERE m.status = 'awaiting_payment' AND m.paidAt IS NULL AND p.status != 'cancelled') AS awaitingPayment,
         (SELECT COUNT(*) FROM milestones WHERE paymentReportedAt IS NOT NULL AND paidAt IS NULL) AS paymentsReported,
         (SELECT COUNT(*) FROM support_requests WHERE status = 'new') AS supportRequests`
    )
    .get() as { activeProjects: number; awaitingPayment: number; paymentsReported: number; supportRequests: number };
}

// ---- Invoices ----

export type InvoiceKind = 'milestone' | 'hosting';
export type InvoiceStatus = 'unpaid' | 'paid' | 'void';

export interface InvoiceLine {
  description: string;
  amount: number; // pence
}

export interface InvoiceData {
  seller: { name: string; address: string; email: string };
  buyer: { name: string; company: string; address: string; email: string };
  projectTitle: string;
  projectReference: string;
  paymentReference: string;
  lines: InvoiceLine[];
  supplyDate: string;
  notes: string;
  paidBy?: 'bank' | 'card';
}

export interface Invoice {
  id: number;
  number: string;
  projectId: number;
  milestoneId: number | null;
  kind: InvoiceKind;
  months: number | null;
  status: InvoiceStatus;
  total: number;
  data: InvoiceData;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
}

const toInvoice = (row: Row) => ({ ...row, data: JSON.parse(String(row.data)) }) as Invoice;

// Numbers run on without gaps within each year: INV-2026-0001, INV-2026-0002…
export function InsertInvoice(invoice: Omit<Invoice, 'id' | 'number' | 'status' | 'paidAt'>) {
  return db.transaction(() => {
    const year = invoice.issuedAt.slice(0, 4);
    const { count } = db.prepare("SELECT COUNT(*) AS count FROM invoices WHERE number LIKE ?").get(`INV-${year}-%`) as { count: number };
    const number = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    const info = db
      .prepare('INSERT INTO invoices (number, projectId, milestoneId, kind, months, total, data, issuedAt, dueAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(number, invoice.projectId, invoice.milestoneId, invoice.kind, invoice.months, invoice.total, JSON.stringify(invoice.data), invoice.issuedAt, invoice.dueAt);
    return Number(info.lastInsertRowid);
  }).immediate();
}

export function GetInvoice(id: number) {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Row | undefined;
  return row ? toInvoice(row) : null;
}

export function ListInvoices(projectId: number) {
  return (db.prepare('SELECT * FROM invoices WHERE projectId = ? ORDER BY id DESC').all(projectId) as Row[]).map(toInvoice);
}

export function GetOpenMilestoneInvoice(milestoneId: number) {
  const row = db.prepare("SELECT * FROM invoices WHERE milestoneId = ? AND status != 'void' ORDER BY id DESC LIMIT 1").get(milestoneId) as Row | undefined;
  return row ? toInvoice(row) : null;
}

// Paying can add a line (the business card fee) to the frozen invoice
export function MarkInvoicePaid(id: number, data: InvoiceData, total: number) {
  return db
    .prepare("UPDATE invoices SET status = 'paid', paidAt = ?, data = ?, total = ? WHERE id = ? AND status = 'unpaid'")
    .run(new Date().toISOString(), JSON.stringify(data), total, id).changes;
}

export function VoidInvoice(id: number) {
  return db.prepare("UPDATE invoices SET status = 'void' WHERE id = ? AND status = 'unpaid'").run(id).changes;
}

export function SetHostingPaidUntil(projectId: number, date: string) {
  db.prepare('UPDATE projects SET hostingPaidUntil = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(date, projectId);
}

// ---- Code handover ----

export interface HandoverFile {
  id: number;
  projectId: number;
  fileName: string;
  storedName: string;
  size: number;
  sha256: string;
  uploadedAt: string | null;
  downloads: number;
}

export function ListHandoverFiles(projectId: number) {
  return (
    db
      .prepare(
        `SELECT f.*, (SELECT COUNT(*) FROM handover_downloads d WHERE d.fileId = f.id) AS downloads
         FROM handover_files f WHERE f.projectId = ? ORDER BY f.id`
      )
      .all(projectId) as Row[]
  ).map((row) => ({ ...row, uploadedAt: sqliteToIso(row.uploadedAt as string) }) as HandoverFile);
}

export function GetHandoverFile(id: number) {
  return db.prepare('SELECT * FROM handover_files WHERE id = ?').get(id) as Omit<HandoverFile, 'downloads'> | undefined;
}

export function InsertHandoverFile(file: Pick<HandoverFile, 'projectId' | 'fileName' | 'storedName' | 'size' | 'sha256'>) {
  const info = db
    .prepare('INSERT INTO handover_files (projectId, fileName, storedName, size, sha256) VALUES (?, ?, ?, ?, ?)')
    .run(file.projectId, file.fileName, file.storedName, file.size, file.sha256);
  return Number(info.lastInsertRowid);
}

export function DeleteHandoverFile(id: number) {
  return db.prepare('DELETE FROM handover_files WHERE id = ?').run(id).changes;
}

export function LogHandoverDownload(fileId: number, clientId: number, ip: string) {
  db.prepare('INSERT INTO handover_downloads (fileId, clientId, ip) VALUES (?, ?, ?)').run(fileId, clientId, ip);
}

export function UpdateHandoverDetails(projectId: number, notes: string, repoUrl: string) {
  return db.prepare('UPDATE projects SET handoverNotes = ?, handoverRepoUrl = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(notes, repoUrl, projectId).changes;
}
