/*
 * @name: Dashboard
 * @description: The figures, to-dos and recent activity on the admin dashboard.
 * */

import { getDb } from './dbConnect';
import { financeYear, vatOverview } from './finance';
import { addDays, formatPence, londonDay } from './format';
import './query/finance.query';
import './query/bookings.query';

export interface Attention {
  tone: 'amber' | 'red' | 'blue';
  text: string;
  href: string;
}

export interface Activity {
  at: string;
  text: string;
  href: string;
}

export function dashboardData() {
  const db = getDb('clients');
  const bookings = getDb('bookings');
  const today = londonDay(new Date());
  const year = financeYear();
  const vat = vatOverview();
  const attention: Attention[] = [];

  const reported = db.prepare("SELECT COUNT(*) AS n FROM milestones WHERE paymentReportedAt IS NOT NULL AND paidAt IS NULL").get() as { n: number };
  if (reported.n) attention.push({ tone: 'amber', text: `${reported.n} client payment${reported.n === 1 ? '' : 's'} marked as sent: check your bank`, href: '/admin/Jobs' });

  const unpaid = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total, COALESCE(SUM(CASE WHEN dueAt < ? THEN 1 ELSE 0 END), 0) AS overdue FROM invoices WHERE status = 'unpaid'").get(today) as { n: number; total: number; overdue: number };
  if (unpaid.overdue) attention.push({ tone: 'red', text: `${unpaid.overdue} overdue invoice${unpaid.overdue === 1 ? '' : 's'}`, href: '/admin/Jobs' });

  const unsigned = db.prepare("SELECT COUNT(*) AS n FROM contracts WHERE status = 'sent' AND sentAt < ?").get(addDays(today, -7)) as { n: number };
  if (unsigned.n) attention.push({ tone: 'amber', text: `${unsigned.n} contract${unsigned.n === 1 ? '' : 's'} unsigned for over a week`, href: '/admin/Jobs' });

  const support = db.prepare("SELECT COUNT(*) AS n FROM support_requests WHERE status = 'new'").get() as { n: number };
  if (support.n) attention.push({ tone: 'blue', text: `${support.n} new support request${support.n === 1 ? '' : 's'}`, href: '/admin/Jobs' });

  const bank = db.prepare("SELECT COUNT(*) AS n FROM bank_transactions WHERE status = 'new'").get() as { n: number };
  if (bank.n) attention.push({ tone: 'blue', text: `${bank.n} bank line${bank.n === 1 ? '' : 's'} to sort out`, href: '/admin/Money/Bank' });

  for (const period of vat.periods.filter((p) => !p.open && !p.submitted)) {
    attention.push({ tone: period.due < today ? 'red' : 'amber', text: `VAT return ${period.label} due ${period.due}`, href: '/admin/Money/Vat' });
  }
  const soon = addDays(today, 30);
  for (const deadline of [...year.deadlines, ...year.quarters.map((q) => ({ date: q.due, label: `Making Tax Digital update for Q${q.number}` }))]) {
    if (deadline.date >= today && deadline.date <= soon) attention.push({ tone: 'amber', text: `${deadline.label}: ${deadline.date}`, href: '/admin/Money' });
  }

  const callsToday = bookings.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed' AND substr(startsAt, 1, 10) = ?").get(today) as { n: number };
  if (callsToday.n) attention.push({ tone: 'blue', text: `${callsToday.n} call${callsToday.n === 1 ? '' : 's'} today`, href: '/admin/Bookings' });

  // Recent activity from across the system, newest first
  const activity: Activity[] = [
    ...(bookings.prepare('SELECT name, company, startsAt, createdAt FROM bookings ORDER BY id DESC LIMIT 6').all() as { name: string; company: string; startsAt: string; createdAt: string }[]).map((b) => ({
      at: b.createdAt.replace(' ', 'T') + 'Z',
      text: `${b.name}${b.company ? ` (${b.company})` : ''} booked a call for ${b.startsAt.slice(0, 10)}`,
      href: '/admin/Bookings',
    })),
    ...(db.prepare('SELECT p.amount, p.fee, p.method, p.createdAt, m.projectId, m.title FROM payments p JOIN milestones m ON m.id = p.milestoneId ORDER BY p.id DESC LIMIT 6').all() as { amount: number; method: string; createdAt: string; projectId: number; title: string }[]).map((p) => ({
      at: p.createdAt.replace(' ', 'T') + 'Z',
      text: `${formatPence(p.amount)} received by ${p.method === 'card' ? 'card' : 'bank transfer'} for "${p.title}"`,
      href: `/admin/Jobs/${p.projectId}`,
    })),
    ...(db.prepare("SELECT c.signedAt, c.signedName, c.projectId FROM contracts c WHERE c.status = 'signed' ORDER BY c.signedAt DESC LIMIT 6").all() as { signedAt: string; signedName: string; projectId: number }[]).map((c) => ({
      at: c.signedAt,
      text: `${c.signedName} signed a contract`,
      href: `/admin/Jobs/${c.projectId}`,
    })),
    ...(db.prepare('SELECT id, number, total, issuedAt FROM invoices ORDER BY id DESC LIMIT 6').all() as { id: number; number: string; total: number; issuedAt: string }[]).map((i) => ({
      at: `${i.issuedAt}T12:00:00Z`,
      text: `Invoice ${i.number} issued for ${formatPence(i.total)}`,
      href: `/admin/invoices/${i.id}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return {
    finance: {
      yearLabel: year.year.label,
      turnover: year.income.turnover,
      profit: year.profit,
      estimatedTax: Math.round(year.estimate.total * 100),
      setAsidePercent: year.setAsidePercent,
    },
    outstanding: { count: unpaid.n, total: unpaid.total },
    attention,
    activity,
  };
}
