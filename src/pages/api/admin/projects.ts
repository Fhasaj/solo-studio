import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import {
  DeleteMilestone,
  DeleteProject,
  GetClient,
  GetProject,
  InsertMilestone,
  InsertProject,
  ListContracts,
  ListMilestones,
  ListPayments,
  ListInvoices,
  ListHandoverFiles,
  ListProjects,
  ListSupportRequests,
  ListUpdates,
  MarkSupportRequestHandled,
  GetSupportRequest,
  PROJECT_STATUSES,
  UpdateProject,
  type ProjectInput,
} from '@/lib/query/clients.query';
import { GetSiteSettings } from '@/lib/query/settings.query';
import { describeMilestones, handoverReleased, supportEndsOn } from '@/lib/portal';
import { hostingFee } from '@/lib/hosting';
import { stripeReady } from '@/lib/stripe';
import { getPreset, presetMilestones } from '@/lib/projectPresets';
import { readBool, readDate, readEnum, readId, readInt, readMoney, readText, sendApiError, ValidationError } from '@/lib/validate';
import { PAYMENT_TIMINGS, type HostingCost } from '@/lib/query/clients.query';

function readHostingCosts(value: unknown): HostingCost[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new ValidationError('hostingCosts', 'Add up to 20 hosting costs');
  return value.map((item, index) => {
    const field = `hostingCosts.${index}`;
    const cost = (item ?? {}) as Record<string, unknown>;
    return {
      label: readText(cost.label, field, { label: 'Cost name', max: 80, required: true }),
      amount: readMoney(cost.amount ?? '0', field, { label: 'Cost amount' }),
      period: readEnum(cost.period ?? 'month', field, ['month', 'year'] as const, 'Billing period'),
    };
  });
}

// Puts a preset's milestones on a job. With replace, existing milestones are swapped out,
// but only while none has been started, invoiced or paid.
function applyPreset(projectId: number, presetId: unknown, replace = false) {
  const preset = getPreset(presetId);
  if (!preset) throw new ValidationError('presetId', 'Choose a preset');
  const project = GetProject(projectId)!;
  const existing = ListMilestones(projectId);
  if (existing.length && !replace) throw new ValidationError('presetId', 'This job already has milestones.');
  if (existing.some((m) => m.status !== 'upcoming' || m.paidAt || m.paymentRequestedAt)) {
    throw new ValidationError('presetId', 'Work or payments have already started on this job, so its milestones can only be edited one by one.');
  }
  if (!project.totalPrice) throw new ValidationError('totalPrice', 'Set the total price first, so the preset can split it into stages');
  existing.forEach((m) => DeleteMilestone(m.id));
  for (const milestone of presetMilestones(preset, project.totalPrice, Number(GetSiteSettings().depositPercent))) {
    InsertMilestone(projectId, milestone);
  }
}

function readInput(body: Record<string, unknown>): ProjectInput {
  const status = readEnum(body.status ?? 'planning', 'status', PROJECT_STATUSES, 'Status');
  const completedAt = readDate(body.completedAt, 'completedAt', { label: 'Completed on' }) || null;
  const hostingCosts = readHostingCosts(body.hostingCosts);
  if (status === 'completed' && !completedAt) throw new ValidationError('completedAt', 'Set the completion date, so the support period can be worked out');
  return {
    title: readText(body.title, 'title', { label: 'Title', max: 150, required: true }),
    summary: readText(body.summary, 'summary', { label: 'Scope', max: 10_000, multiline: true }),
    status,
    totalPrice: readMoney(body.totalPrice ?? '0', 'totalPrice', { label: 'Total price' }),
    supportMonths: readInt(body.supportMonths ?? GetSiteSettings().supportMonths, 'supportMonths', { label: 'Support months', min: 0, max: 60 }),
    completedAt,
    supportExtendedUntil: readDate(body.supportExtendedUntil, 'supportExtendedUntil', { label: 'Support extended until' }) || null,
    // The fee is always worked out here from the costs, never taken from the browser
    hostingMonthly: hostingFee(hostingCosts, Number(GetSiteSettings().hostingMarkupPercent)),
    hostingPaidUntil: readDate(body.hostingPaidUntil, 'hostingPaidUntil', { label: 'Hosting paid until' }) || null,
    hostingCosts,
    // New jobs default to being paid stage by stage, up front
    paymentTiming: readEnum(body.paymentTiming ?? 'before', 'paymentTiming', PAYMENT_TIMINGS, 'Payment timing'),
    allowCard: readBool(body.allowCard ?? false, 'allowCard'),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    switch (req.method) {
      case 'GET': {
        if (!req.query.id) return res.status(200).json({ ok: true, data: ListProjects() });
        const project = GetProject(readId(req.query.id));
        if (!project) return res.status(404).json({ ok: false, error: 'Not found' });
        return res.status(200).json({
          ok: true,
          data: {
            project,
            client: GetClient(project.clientId),
            milestones: describeMilestones(project, ListMilestones(project.id)),
            updates: ListUpdates(project.id),
            contracts: ListContracts(project.id),
            supportRequests: ListSupportRequests(project.id),
            supportEndsOn: supportEndsOn(project),
            payments: ListPayments(project.id),
            invoices: ListInvoices(project.id),
            handoverFiles: ListHandoverFiles(project.id),
            handoverReleased: handoverReleased(ListMilestones(project.id)),
            cardReady: stripeReady(),
          },
        });
      }
      case 'POST': {
        const clientId = readId(body.clientId, 'clientId');
        if (!GetClient(clientId)) throw new ValidationError('clientId', 'Choose a client');
        const preset = body.presetId ? getPreset(body.presetId) : null;
        if (body.presetId && !preset) throw new ValidationError('presetId', 'Choose a preset');
        const input = readInput(body);
        if (preset && !input.totalPrice) throw new ValidationError('totalPrice', 'Set the total price, so the preset can split it into stages');
        // A preset fills in the scope only when none was written
        const id = InsertProject(clientId, { ...input, summary: input.summary || preset?.scope || '' });
        if (preset) applyPreset(id, preset.id);
        return res.status(200).json({ ok: true, id });
      }
      case 'PUT': {
        const id = readId(body.id);
        if (!GetProject(id)) return res.status(404).json({ ok: false, error: 'Not found' });
        UpdateProject(id, readInput(body));
        return res.status(200).json({ ok: true });
      }
      case 'PATCH': {
        if (body.presetId !== undefined) {
          const id = readId(body.id);
          if (!GetProject(id)) return res.status(404).json({ ok: false, error: 'Not found' });
          applyPreset(id, body.presetId, body.replace === true);
          return res.status(200).json({ ok: true });
        }
        // Marks a support request as dealt with
        const request = GetSupportRequest(readId(body.supportRequestId, 'supportRequestId'));
        if (!request) return res.status(404).json({ ok: false, error: 'Not found' });
        MarkSupportRequestHandled(request.id);
        return res.status(200).json({ ok: true });
      }
      case 'DELETE': {
        const result = DeleteProject(readId(body.id));
        if (result === -1) throw new ValidationError('id', 'This job has a signed contract or recorded payments, so it is kept as a record. Set it to cancelled instead.');
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(405).end();
    }
  } catch (err) {
    return sendApiError(res, err);
  }
}
