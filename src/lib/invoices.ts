/*
 * @name: Invoices
 * @description: Numbered invoices for milestones and hosting. Each one freezes the details it was issued with,
 * so changing a client's address later never alters a past invoice. Invoices are voided, never deleted.
 * */

import { GetSiteSettings } from './query/settings.query';
import {
  GetClient,
  GetOpenMilestoneInvoice,
  InsertInvoice,
  MarkInvoicePaid,
  SetHostingPaidUntil,
  VoidInvoice,
  type Invoice,
  type InvoiceData,
  type Milestone,
  type Project,
} from './query/clients.query';
import { addDays, addMonths, formatDate, londonDay } from './format';
import { vatProfile } from './finance';
import { vatTreatment } from './vat';

const PAYMENT_TERMS_DAYS = 14;

function baseData(project: Project, paymentReference: string, lines: InvoiceData['lines']): InvoiceData {
  const settings = GetSiteSettings();
  const client = GetClient(project.clientId);
  const today = londonDay(new Date());
  const profile = vatProfile(settings, today);
  // Whether VAT applies, and at what rate, depends on where the client is
  const treatment = vatTreatment(profile, today, { country: client?.country ?? '', vatNumber: client?.vatNumber ?? '' });
  const net = lines.reduce((sum, line) => sum + line.amount, 0);
  const registered = treatment.code !== 'not_registered';
  return {
    seller: { name: settings.businessName, address: settings.businessAddress, email: settings.contactEmail, vatNumber: registered ? settings.vatNumber : undefined },
    buyer: { name: client?.name ?? '', company: client?.company ?? '', address: client?.address ?? '', email: client?.email ?? '' },
    projectTitle: project.title,
    projectReference: project.reference,
    paymentReference,
    lines,
    supplyDate: today,
    notes: treatment.note,
    vat: registered ? { rate: treatment.rate, amount: Math.round((net * treatment.rate) / 100), code: treatment.code, note: treatment.note } : undefined,
  };
}

function totalOf(data: InvoiceData) {
  return data.lines.reduce((sum, line) => sum + line.amount, 0) + (data.vat?.amount ?? 0);
}

function issue(project: Project, kind: Invoice['kind'], milestoneId: number | null, months: number | null, data: InvoiceData) {
  const today = londonDay(new Date());
  return InsertInvoice({
    projectId: project.id,
    milestoneId,
    kind,
    months,
    total: totalOf(data),
    data,
    issuedAt: today,
    dueAt: addDays(today, PAYMENT_TERMS_DAYS),
  });
}

// One live invoice per milestone: asking for the same payment again reuses it
export function issueMilestoneInvoice(project: Project, milestone: Milestone, paymentReference: string) {
  const open = GetOpenMilestoneInvoice(milestone.id);
  if (open) return open.id;
  return issue(project, 'milestone', milestone.id, null, baseData(project, paymentReference, [{ description: `${milestone.title}: ${project.title}`, amount: milestone.amount }]));
}

export function voidMilestoneInvoice(milestoneId: number) {
  const open = GetOpenMilestoneInvoice(milestoneId);
  if (open?.status === 'unpaid') VoidInvoice(open.id);
}

// Marks the milestone's invoice paid, adding the business card fee if one was paid. Issues one first if needed,
// so every payment ends up with a paid invoice as its receipt.
export function payMilestoneInvoice(project: Project, milestone: Milestone, paymentReference: string, fee: number, paidBy: 'bank' | 'card') {
  let invoice = GetOpenMilestoneInvoice(milestone.id);
  if (!invoice || invoice.status === 'paid') {
    if (invoice?.status === 'paid') return invoice.id;
    issueMilestoneInvoice(project, milestone, paymentReference);
    invoice = GetOpenMilestoneInvoice(milestone.id)!;
  }
  const lines = fee ? [...invoice.data.lines, { description: 'Card processing fee (business card)', amount: fee, fee: true }] : invoice.data.lines;
  const data = { ...invoice.data, lines, paidBy };
  MarkInvoicePaid(invoice.id, data, totalOf(data));
  return invoice.id;
}

// Hosting runs on from wherever it's paid up to (or today, if that's already passed)
export function hostingPeriod(project: Project, months: number) {
  const today = londonDay(new Date());
  const start = project.hostingPaidUntil && project.hostingPaidUntil > today ? addDays(project.hostingPaidUntil, 1) : today;
  return { start, end: addDays(addMonths(start, months), -1) };
}

export function issueHostingInvoice(project: Project, months: number) {
  const { start, end } = hostingPeriod(project, months);
  return issue(
    project,
    'hosting',
    null,
    months,
    baseData(project, `${project.reference}-H`, [
      { description: `Hosting and maintenance, ${formatDate(start)} to ${formatDate(end)} (${months} month${months === 1 ? '' : 's'})`, amount: project.hostingMonthly * months },
    ])
  );
}

// Paying a hosting invoice moves "hosting paid until" on by the months it covers
export function payHostingInvoice(project: Project, invoice: Invoice) {
  if (invoice.status !== 'unpaid' || !invoice.months) return false;
  // Hosting invoices are confirmed by hand, so they're bank transfers
  MarkInvoicePaid(invoice.id, { ...invoice.data, paidBy: 'bank' }, invoice.total);
  SetHostingPaidUntil(project.id, hostingPeriod(project, invoice.months).end);
  return true;
}

// What the client has to pay for a milestone: its invoice total (which includes any VAT), or the price if not invoiced yet
export function amountDue(milestone: Milestone) {
  const invoice = GetOpenMilestoneInvoice(milestone.id);
  return invoice && invoice.status === 'unpaid' ? invoice.total : milestone.amount;
}
