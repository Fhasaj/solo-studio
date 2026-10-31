/*
 * @name: Client portal
 * @description: The rules behind the client portal: which milestones are blocked by an unpaid payment, payment references,
 * support end dates, contract text, sign-in links and the emails sent along the way.
 * */

import { createHash } from 'crypto';
import { GetSiteSettings } from './query/settings.query';
import {
  GetClient,
  HasSignedContract,
  InsertLoginToken,
  InsertPayment,
  ListHandoverFiles,
  ListActiveMilestones,
  ListContractsAwaitingSignature,
  ListHostingDue,
  ListMilestones,
  type Client,
  type Contract,
  type Invoice,
  type Milestone,
  type Project,
} from './query/clients.query';
import { DEFAULT_CONTRACT_TEMPLATE, fillTemplate, IRISH_CONTRACT_TEMPLATE } from './contractTemplate';
import { taxCountry, vatProfile } from './finance';
import { addDays, addMonths, formatDate, formatPence, formatPounds, londonDay } from './format';
import { hashToken, newToken } from './booking';
import { sendMail } from './mailer';
import { amountDue, payMilestoneInvoice } from './invoices';
import { absoluteUrl } from './site';

export type MilestoneDisplay = 'complete' | 'in_progress' | 'payment_due' | 'payment_reported' | 'paid_ready' | 'on_hold' | 'upcoming';

export interface MilestoneView extends Milestone {
  display: MilestoneDisplay;
  paymentReference: string;
}

function isUnpaid(milestone: Milestone) {
  return milestone.requiresPayment && !milestone.paidAt;
}

// Bank references are limited to 18 characters, so keep them short: FH-2026-007-2
export function paymentReference(project: Project, index: number) {
  return `${project.reference}-${index + 1}`;
}

// Deposits are a payment, not a stage of work, so paying one completes it
export function isDeposit(milestones: Milestone[], milestone: Milestone) {
  return milestones[0]?.id === milestone.id && /deposit/i.test(milestone.title);
}

// Adds what the client should see for each milestone. Anything after an unpaid payment is on hold.
export function describeMilestones(project: Project, milestones: Milestone[]): MilestoneView[] {
  let blocked = false;
  return milestones.map((milestone, index) => {
    let display: MilestoneDisplay;
    if (milestone.status === 'complete') display = 'complete';
    else if (milestone.status === 'awaiting_payment') display = milestone.paymentReportedAt ? 'payment_reported' : 'payment_due';
    else if (milestone.status === 'in_progress') display = 'in_progress';
    else if (blocked) display = 'on_hold';
    else display = milestone.paidAt ? 'paid_ready' : 'upcoming';

    if (isUnpaid(milestone)) blocked = true;
    return { ...milestone, display, paymentReference: paymentReference(project, index) };
  });
}

// Why work on a milestone can't start yet, or null if it can
export function startBlocker(project: Project, milestoneId: number) {
  if (!HasSignedContract(project.id)) return 'The contract has to be signed before work starts.';
  const milestones = ListMilestones(project.id);
  const index = milestones.findIndex((milestone) => milestone.id === milestoneId);
  const unpaid = milestones.slice(0, index).find(isUnpaid);
  if (unpaid) return `"${unpaid.title}" has to be paid before this milestone can start.`;
  // Pay-before jobs: a stage that needs paying is paid before work on it starts
  if (project.paymentTiming === 'before' && isUnpaid(milestones[index])) return 'This stage has to be paid before it starts. Request the payment first.';
  return null;
}

// The code is handed over once every milestone that needs paying has been paid
export function handoverReleased(milestones: Milestone[]) {
  const payable = milestones.filter((m) => m.requiresPayment);
  return payable.length > 0 && payable.every((m) => m.paidAt);
}

export async function notifyHandoverReady(project: Project) {
  const client = GetClient(project.clientId);
  if (!client) return;
  await sendMail({
    to: client.email,
    replyTo: adminAddress() || undefined,
    subject: `Your code is ready to download: ${project.title}`,
    text: [
      `Hi ${client.name},`,
      '',
      `Thanks for your final payment. The code and handover documents for ${project.title} are now available in your client portal:`,
      projectLink(project),
      '',
      'Downloads are only available while signed in. Each file shows a fingerprint (SHA-256) you can use to check it arrived intact.',
      ...signOff(),
    ].join('\n'),
  });
}

// Card fee the client pays on top, in pence: Stripe's fee grossed up so you receive the full amount,
// capped at the most you're willing to pass on (anything above the cap you absorb)
export function cardFee(amount: number, settings = GetSiteSettings()) {
  const percent = Number(settings.cardFeePercent) / 100;
  const fixed = Number(settings.cardFeeFixedPence);
  const cap = Number(settings.cardFeeCap) * 100;
  if (!amount || cap <= 0 || percent >= 1) return 0;
  const fee = Math.ceil((amount + fixed) / (1 - percent)) - amount;
  return Math.min(fee, cap);
}

// Records a bank or card payment, marks the milestone paid and tells the client.
// Returns false if it was already recorded (Stripe can send the same event twice).
export async function recordPayment(project: Project, milestone: Milestone, payment: { method: 'bank' | 'card'; fee?: number; reference?: string | null }) {
  const milestones = ListMilestones(project.id);
  // Paid-after stages are finished; paid-before stages are now ready to start
  const nextStatus = project.paymentTiming === 'after' || isDeposit(milestones, milestone) ? 'complete' : milestone.status === 'in_progress' ? 'in_progress' : 'upcoming';
  const recorded = InsertPayment(
    { milestoneId: milestone.id, method: payment.method, amount: amountDue(milestone), fee: payment.fee ?? 0, reference: payment.reference ?? null },
    nextStatus
  );
  if (!recorded) return false;
  const index = milestones.findIndex((m) => m.id === milestone.id);
  payMilestoneInvoice(project, milestone, paymentReference(project, index), payment.fee ?? 0, payment.method);
  await notifyPaymentConfirmed(project, milestone);
  // The final payment releases the code handover
  const updated = ListMilestones(project.id);
  if (handoverReleased(updated) && (ListHandoverFiles(project.id).length || project.handoverRepoUrl)) await notifyHandoverReady(project);
  if (payment.method === 'card') {
    await sendMail({
      to: adminAddress(),
      subject: `Card payment received: ${formatPence(milestone.amount)} for ${project.title}`,
      text: [
        `"${milestone.title}" for ${project.title} (${project.reference}) has been paid by card through Stripe.`,
        `Amount: ${formatPence(milestone.amount)}${payment.fee ? ` plus ${formatPence(payment.fee)} card fee` : ''}`,
        '',
        absoluteUrl(`/admin/Jobs/${project.id}`),
      ].join('\n'),
    });
  }
  return true;
}


// The last day of free (or paid-for) support, or null until the project is complete
export function supportEndsOn(project: Project) {
  if (project.supportExtendedUntil) return project.supportExtendedUntil;
  return project.completedAt ? addMonths(project.completedAt, project.supportMonths) : null;
}

export function contractHash(body: string) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function buildContractBody(project: Project, client: Client) {
  const settings = GetSiteSettings();
  const milestones = ListMilestones(project.id);
  // Use the job's own deposit milestone when it has one (presets for small jobs take 50%)
  const depositMilestone = milestones[0]?.requiresPayment && /deposit/i.test(milestones[0].title) ? milestones[0] : null;
  const deposit = depositMilestone ? depositMilestone.amount : Math.round((project.totalPrice * Number(settings.depositPercent)) / 100);
  const depositPercent = depositMilestone && project.totalPrice ? String(Math.round((deposit / project.totalPrice) * 100)) : settings.depositPercent;

  const milestoneLines = milestones.length
    ? milestones
        .map((m) => `- ${m.title}: ${formatPence(m.amount)}${m.requiresPayment ? ', to be paid before work continues' : ''}${m.dueDate ? ` (target ${formatDate(m.dueDate)})` : ''}`)
        .join('\n')
    : '- [Add milestones to the project before generating the contract]';

  const vat = vatProfile(settings);
  // An unedited UK template is swapped for the Irish one when you pay tax in Ireland
  const template = taxCountry(settings) === 'ie' && settings.contractTemplate === DEFAULT_CONTRACT_TEMPLATE ? IRISH_CONTRACT_TEMPLATE : settings.contractTemplate;
  return fillTemplate(template, {
    businessName: settings.businessName,
    businessAddress: settings.businessAddress.replace(/\n+/g, ', ') || '[Add your business address in Settings]',
    clientName: client.name,
    clientCompany: client.company || client.name,
    clientEmail: client.email,
    projectTitle: project.title,
    projectReference: project.reference,
    projectSummary: project.summary || '[Describe the agreed scope in the project summary]',
    totalPrice: formatPence(project.totalPrice),
    depositPercent,
    depositAmount: formatPence(deposit),
    milestones: milestoneLines,
    supportMonths: String(project.supportMonths),
    supportBasicPrice: formatPounds(settings.supportBasicPrice),
    supportPriorityPrice: formatPounds(settings.supportPriorityPrice),
    dayRate: formatPounds(settings.dayRate),
    paymentRule:
      project.paymentTiming === 'before'
        ? 'Each milestone marked as requiring payment must be paid before work on that milestone begins.'
        : 'Each milestone marked as requiring payment must be paid when it is delivered, before work on the next milestone begins.',
    paymentMethods: project.allowCard
      ? 'Payments are made by bank transfer using the reference shown in the client portal, or by card through the client portal. Card payments made with a business card may include a fee covering the card processing cost; no fee is added for bank transfers or personal cards.'
      : 'Payments are made by bank transfer using the reference shown in the client portal.',
    vatNote: vat.registered
      ? `All prices exclude VAT. VAT is added at the applicable rate (currently ${vat.standardRate}%) where it applies, and shown on each invoice.`
      : 'The Developer is not registered for VAT, so no VAT is added to these amounts. If the Developer registers for VAT during the project, VAT will be added to invoices issued after registration at the applicable rate.',
    hosting: project.hostingMonthly
      ? `The Developer will host and maintain the software for ${formatPence(project.hostingMonthly)} per month, paid monthly in advance from launch. This covers the server, backups, security updates and monitoring. Either party may end hosting with 30 days' written notice, and the Developer will then hand over the software and data once all amounts due have been paid. If hosting fees are unpaid, section 4 applies and the service may be suspended until they are paid.`
      : 'The Client will host the software on their own infrastructure, at their own cost. The Developer will help with the first deployment as part of the project.',
    date: formatDate(londonDay(new Date())),
  });
}

// ---- Admin work board ----

interface BoardMilestone {
  id: number;
  title: string;
  amount: number;
  projectId: number;
  projectTitle: string;
  clientName: string;
}

export interface WorkBoard {
  inProgress: BoardMilestone[];
  // needsPayment: a pay-before stage that must be paid before it can start
  readyToStart: (BoardMilestone & { needsPayment: boolean })[];
  waitingForContract: { projectId: number; projectTitle: string; clientName: string; contractSent: boolean }[];
  awaitingPayment: (BoardMilestone & { requestedAt: string | null; reportedAt: string | null; overdue: boolean; reference: string })[];
  contractsAwaitingSignature: { id: number; projectId: number; projectTitle: string; clientName: string; sentAt: string }[];
  hostingDue: { projectId: number; projectTitle: string; clientName: string; amount: number; paidUntil: string | null }[];
}

// What's being worked on, what can start next, and who owes what
export function buildWorkBoard(): WorkBoard {
  const board: WorkBoard = { inProgress: [], readyToStart: [], waitingForContract: [], awaitingPayment: [], contractsAwaitingSignature: [], hostingDue: [] };
  const contracts = ListContractsAwaitingSignature();
  board.contractsAwaitingSignature = contracts;

  const byProject = new Map<number, ReturnType<typeof ListActiveMilestones>>();
  for (const row of ListActiveMilestones()) {
    const list = byProject.get(row.projectId as number) ?? [];
    list.push(row);
    byProject.set(row.projectId as number, list);
  }

  const overdueBefore = Date.now() - 14 * 24 * 3_600_000;
  for (const [projectId, rows] of byProject) {
    const base = (row: (typeof rows)[number]): BoardMilestone => ({
      id: row.id as number,
      title: row.title as string,
      amount: row.amount as number,
      projectId,
      projectTitle: row.projectTitle,
      clientName: row.clientCompany ? `${row.clientName}, ${row.clientCompany}` : row.clientName,
    });

    let blocked = false;
    let nextFound = false;
    rows.forEach((row, index) => {
      if (row.status === 'in_progress') board.inProgress.push(base(row));
      if (row.status === 'awaiting_payment' && !row.paidAt) {
        board.awaitingPayment.push({
          ...base(row),
          requestedAt: row.paymentRequestedAt as string | null,
          reportedAt: row.paymentReportedAt as string | null,
          overdue: Boolean(row.paymentRequestedAt && Date.parse(row.paymentRequestedAt as string) < overdueBefore),
          reference: `${row.projectReference}-${index + 1}`,
        });
      }
      // The first milestone not yet started, as long as nothing before it is unpaid
      if (row.status === 'upcoming' && !nextFound && !blocked) {
        nextFound = true;
        if (HasSignedContract(projectId)) {
          board.readyToStart.push({ ...base(row), needsPayment: row.paymentTiming === 'before' && row.requiresPayment === 1 && !row.paidAt });
        }
        else board.waitingForContract.push({ projectId, projectTitle: row.projectTitle, clientName: row.clientName, contractSent: contracts.some((c) => c.projectId === projectId) });
      }
      if (row.requiresPayment === 1 && !row.paidAt) blocked = true;
    });
  }

  board.hostingDue = ListHostingDue(addDays(londonDay(new Date()), 14)).map((p) => ({
    projectId: p.id,
    projectTitle: p.title,
    clientName: p.clientName,
    amount: p.hostingMonthly,
    paidUntil: p.hostingPaidUntil,
  }));
  return board;
}

// ---- Emails ----

function adminAddress() {
  return GetSiteSettings().contactEmail || process.env.EMAIL_TO || '';
}

// A function so the name follows Settings
const signOff = () => ['', 'Thanks,', GetSiteSettings().ownerName];

export async function sendLoginLink(client: Client, { invite = false } = {}) {
  const token = newToken();
  // Invites may sit in an inbox for a while; sign-in links are used straight away
  const lifetimeMs = invite ? 72 * 3_600_000 : 20 * 60_000;
  InsertLoginToken(client.id, hashToken(token), new Date(Date.now() + lifetimeMs).toISOString());
  const link = absoluteUrl(`/portal/verify?token=${encodeURIComponent(token)}`);

  const sent = await sendMail({
    to: client.email,
    replyTo: adminAddress() || undefined,
    subject: invite ? `Your client portal with ${GetSiteSettings().siteName}` : 'Your sign-in link',
    text: [
      `Hi ${client.name},`,
      '',
      invite
        ? "I've set up a client portal where you can follow the progress of your project, see what's due and sign your contract."
        : 'Here is your link to sign in to the client portal.',
      '',
      link,
      '',
      `The link works once and expires in ${invite ? '3 days' : '20 minutes'}. You can always request a new one at ${absoluteUrl('/portal/login')}.`,
      "If you didn't ask for this, you can ignore this email.",
      ...signOff(),
    ].join('\n'),
  });
  // Local development only: if the email fails, print the link so you can still test the portal
  if (!sent && process.env.NODE_ENV !== 'production') {
    // Points at the local dev server rather than the live site
    const local = `http://localhost:${process.env.PORT || 3000}/portal/verify?token=${encodeURIComponent(token)}`;
    console.info(`[portal link] Email failed, so here is ${client.email}'s sign-in link for development: ${local}`);
    return true;
  }
  return sent;
}

function projectLink(project: Project) {
  return absoluteUrl(`/portal/projects/${project.id}`);
}

export async function notifyPaymentRequested(project: Project, milestone: MilestoneView, invoice?: Invoice | null) {
  const client = GetClient(project.clientId);
  if (!client) return;
  await sendMail({
    to: client.email,
    replyTo: adminAddress() || undefined,
    subject: `Payment due: ${milestone.title} (${project.reference})`,
    text: [
      `Hi ${client.name},`,
      '',
      `"${milestone.title}" for ${project.title} is ready for payment: ${formatPence(invoice?.total ?? milestone.amount)}${invoice?.data.vat?.amount ? ' including VAT' : ''}.`,
      ...(invoice ? ['', `Invoice ${invoice.number}: ${absoluteUrl(`/portal/invoices/${invoice.id}`)}`] : []),
      '',
      `Please pay by bank transfer within 14 days using the reference ${milestone.paymentReference}. The bank details are in your client portal:`,
      projectLink(project),
      '',
      "Work on the next stage starts as soon as the payment arrives. Once you've paid, press \"I've sent the payment\" in the portal so I know to look out for it.",
      ...signOff(),
    ].join('\n'),
  });
}

export async function notifyPaymentReported(project: Project, milestone: MilestoneView) {
  const client = GetClient(project.clientId);
  await sendMail({
    to: adminAddress(),
    subject: `Payment sent: ${client?.name ?? 'Client'} says they've paid ${formatPence(milestone.amount)} (${milestone.paymentReference})`,
    text: [
      `${client?.name ?? 'The client'}${client?.company ? ` (${client.company})` : ''} says they've paid "${milestone.title}" for ${project.title}.`,
      '',
      `Amount: ${formatPence(milestone.amount)}`,
      `Reference: ${milestone.paymentReference}`,
      '',
      `Check your bank, then confirm it here: ${absoluteUrl(`/admin/Jobs/${project.id}`)}`,
    ].join('\n'),
  });
}

export async function notifyPaymentConfirmed(project: Project, milestone: Milestone) {
  const client = GetClient(project.clientId);
  if (!client) return;
  await sendMail({
    to: client.email,
    replyTo: adminAddress() || undefined,
    subject: `Payment received: ${milestone.title} (${project.reference})`,
    text: [
      `Hi ${client.name},`,
      '',
      `Thanks, I've received your payment of ${formatPence(milestone.amount)} for "${milestone.title}".`,
      `You can follow the project here: ${projectLink(project)}`,
      ...signOff(),
    ].join('\n'),
  });
}

export async function notifyProjectUpdate(project: Project, body: string) {
  const client = GetClient(project.clientId);
  if (!client) return;
  await sendMail({
    to: client.email,
    replyTo: adminAddress() || undefined,
    subject: `Project update: ${project.title}`,
    text: [`Hi ${client.name},`, '', body, '', `See the full progress: ${projectLink(project)}`, ...signOff()].join('\n'),
  });
}

export async function notifyContractSent(project: Project, contract: Contract) {
  const client = GetClient(project.clientId);
  if (!client) return;
  await sendMail({
    to: client.email,
    replyTo: adminAddress() || undefined,
    subject: `Contract ready to sign: ${project.title}`,
    text: [
      `Hi ${client.name},`,
      '',
      `The contract for ${project.title} is ready for you to review and sign in your client portal:`,
      absoluteUrl(`/portal/contracts/${contract.id}`),
      '',
      'If anything in it needs changing, just reply to this email before signing.',
      ...signOff(),
    ].join('\n'),
  });
}

export async function notifyContractSigned(project: Project, contract: Contract) {
  const client = GetClient(project.clientId);
  const record = [
    `Signed by: ${contract.signedName}`,
    `Signed at: ${contract.signedAt} (UTC)`,
    `IP address: ${contract.signedIp}`,
    `Document fingerprint (SHA-256): ${contract.bodyHash}`,
    `For the Developer: ${contract.providerName}, sent ${contract.sentAt} (UTC)`,
  ].join('\n');
  const copy = `${contract.title}\n\n${contract.body}\n\n---\n${record}`;

  await Promise.all([
    client &&
      sendMail({
        to: client.email,
        replyTo: adminAddress() || undefined,
        subject: `Signed contract: ${project.title}`,
        text: [`Hi ${client.name},`, '', 'Thanks for signing. A copy of the signed contract is below for your records.', '', copy].join('\n'),
      }),
    sendMail({
      to: adminAddress(),
      subject: `Contract signed: ${client?.name ?? 'Client'}, ${project.title}`,
      text: [`${client?.name ?? 'The client'} has signed the contract for ${project.title}.`, '', absoluteUrl(`/admin/Jobs/${project.id}`), '', copy].join('\n'),
    }),
  ]);
}

export async function notifySupportRequest(project: Project, plan: string, months: number, message: string) {
  const client = GetClient(project.clientId);
  await sendMail({
    to: adminAddress(),
    replyTo: client?.email,
    subject: `Support extension requested: ${client?.name ?? 'Client'}, ${project.title}`,
    text: [
      `${client?.name ?? 'The client'} would like the ${plan} support plan for ${months} months on ${project.title}.`,
      '',
      message || '(no message)',
      '',
      absoluteUrl(`/admin/Jobs/${project.id}`),
    ].join('\n'),
  });
}
