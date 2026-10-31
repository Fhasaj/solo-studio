/*
 * @name: Admin search
 * @description: One search box across the whole admin: clients, jobs, invoices, bookings, website content, expenses,
 * settings and pages. Parameterised LIKE queries, a few results per group.
 * */

import { getDb } from './dbConnect';
import { SETTING_FIELDS, SETTING_GROUPS, type SettingField } from './siteSettings';
// Make sure every table exists before searching it
import './query/content.query';
import './query/caseStudies.query';
import './query/bookings.query';
import './query/finance.query';

export interface SearchResult {
  group: string;
  title: string;
  detail: string;
  href: string;
}

const PAGES: { title: string; href: string; keywords: string }[] = [
  { title: 'Dashboard', href: '/admin', keywords: 'home overview work board' },
  { title: 'Bookings', href: '/admin/Bookings', keywords: 'calls calendar appointments' },
  { title: 'Clients', href: '/admin/Clients', keywords: 'customers people portal' },
  { title: 'Jobs', href: '/admin/Jobs', keywords: 'projects milestones payments contracts' },
  { title: 'Money', href: '/admin/Money', keywords: 'tax income profit finance accounts mtd self assessment' },
  { title: 'Expenses, mileage and income', href: '/admin/Money/Expenses', keywords: 'costs receipts mileage' },
  { title: 'Bank', href: '/admin/Money/Bank', keywords: 'statement import csv transactions reconcile' },
  { title: 'VAT', href: '/admin/Money/Vat', keywords: 'vat returns vat3 hmrc revenue' },
  { title: 'Tax rates', href: '/admin/Money/Rates', keywords: 'allowance bands national insurance usc prsi' },
  { title: 'Case studies', href: '/admin/CaseStudies', keywords: 'work portfolio projects' },
  { title: 'Services', href: '/admin/Services', keywords: 'offer pricing' },
  { title: 'Industries', href: '/admin/Industries', keywords: 'sectors niche' },
  { title: 'Testimonials', href: '/admin/Testimonals', keywords: 'reviews quotes' },
  { title: 'FAQs', href: '/admin/Faqs', keywords: 'questions answers' },
  { title: 'Settings', href: '/admin/Settings', keywords: 'configuration sections bank details' },
  { title: 'Account', href: '/admin/Account', keywords: 'password security sign out sessions' },
];

// LIKE with the user's % and _ treated as plain characters
function like(query: string) {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function rows<T>(db: ReturnType<typeof getDb>, sql: string, params: unknown[]) {
  return db.prepare(sql).all(...params) as T[];
}

export function searchAdmin(raw: string): SearchResult[] {
  const query = raw.trim().slice(0, 100);
  if (query.length < 2) return [];
  const q = like(query);
  const lower = query.toLowerCase();
  const results: SearchResult[] = [];
  const clientsDb = getDb('clients');
  const contentDb = getDb('content');
  const LIMIT = 5;

  for (const page of PAGES.filter((p) => `${p.title} ${p.keywords}`.toLowerCase().includes(lower)).slice(0, LIMIT)) {
    results.push({ group: 'Pages', title: page.title, detail: 'Go to page', href: page.href });
  }

  for (const c of rows<{ id: number; name: string; email: string; company: string }>(clientsDb, "SELECT id, name, email, company FROM clients WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' LIMIT ?", [q, q, q, LIMIT])) {
    results.push({ group: 'Clients', title: c.name, detail: [c.company, c.email].filter(Boolean).join(' · '), href: `/admin/Clients/${c.id}` });
  }
  for (const p of rows<{ id: number; title: string; reference: string; clientName: string }>(clientsDb, "SELECT p.id, p.title, p.reference, c.name AS clientName FROM projects p JOIN clients c ON c.id = p.clientId WHERE p.title LIKE ? ESCAPE '\\' OR p.reference LIKE ? ESCAPE '\\' OR p.summary LIKE ? ESCAPE '\\' LIMIT ?", [q, q, q, LIMIT])) {
    results.push({ group: 'Jobs', title: p.title, detail: `${p.reference} · ${p.clientName}`, href: `/admin/Jobs/${p.id}` });
  }
  for (const i of rows<{ id: number; number: string; total: number; status: string; clientName: string }>(clientsDb, "SELECT i.id, i.number, i.total, i.status, c.name AS clientName FROM invoices i JOIN projects p ON p.id = i.projectId JOIN clients c ON c.id = p.clientId WHERE i.number LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR i.data LIKE ? ESCAPE '\\' ORDER BY i.id DESC LIMIT ?", [q, q, q, LIMIT])) {
    results.push({ group: 'Invoices', title: i.number, detail: `${i.clientName} · ${i.status}`, href: `/admin/invoices/${i.id}` });
  }
  for (const e of rows<{ id: number; supplier: string; description: string; date: string }>(clientsDb, "SELECT id, supplier, description, date FROM expenses WHERE supplier LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' ORDER BY date DESC LIMIT ?", [q, q, LIMIT])) {
    results.push({ group: 'Expenses', title: e.supplier || e.description || 'Expense', detail: `${e.date}${e.description && e.supplier ? ` · ${e.description}` : ''}`, href: '/admin/Money/Expenses' });
  }
  for (const b of rows<{ id: number; name: string; company: string; startsAt: string }>(getDb('bookings'), "SELECT id, name, company, startsAt FROM bookings WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\' ORDER BY startsAt DESC LIMIT ?", [q, q, q, q, LIMIT])) {
    results.push({ group: 'Bookings', title: b.name, detail: `${b.company ? `${b.company} · ` : ''}${b.startsAt.slice(0, 10)}`, href: '/admin/Bookings' });
  }
  for (const c of rows<{ id: number; title: string; status: string }>(contentDb, "SELECT id, title, status FROM case_studies WHERE title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR clientName LIKE ? ESCAPE '\\' LIMIT ?", [q, q, q, q, LIMIT])) {
    results.push({ group: 'Case studies', title: c.title, detail: c.status, href: `/admin/CaseStudies/${c.id}` });
  }
  const content: [string, string, string, string][] = [
    ['services', 'title', 'Services', '/admin/Services'],
    ['industries', 'name', 'Industries', '/admin/Industries'],
    ['faqs', 'question', 'FAQs', '/admin/Faqs'],
    ['testimonials', 'name', 'Testimonials', '/admin/Testimonals'],
  ];
  for (const [table, column, group, href] of content) {
    for (const item of rows<{ label: string }>(contentDb, `SELECT ${column} AS label FROM ${table} WHERE ${column} LIKE ? ESCAPE '\\' LIMIT ?`, [q, LIMIT])) {
      results.push({ group, title: item.label, detail: group, href });
    }
  }
  for (const field of (SETTING_FIELDS as readonly SettingField[]).filter((f) => f.label.toLowerCase().includes(lower)).slice(0, LIMIT)) {
    results.push({ group: 'Settings', title: field.label, detail: SETTING_GROUPS[field.group].label, href: `/admin/Settings#${field.group}` });
  }
  return results;
}
