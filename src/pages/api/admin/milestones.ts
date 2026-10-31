import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import {
  DeleteMilestone,
  GetInvoice,
  GetMilestone,
  GetProject,
  InsertMilestone,
  ListMilestones,
  MILESTONE_STATUSES,
  MoveMilestone,
  SetMilestoneStatus,
  TouchProject,
  UpdateMilestone,
  type MilestoneInput,
} from '@/lib/query/clients.query';
import { describeMilestones, isDeposit, notifyPaymentRequested, recordPayment, startBlocker } from '@/lib/portal';
import { issueMilestoneInvoice, voidMilestoneInvoice } from '@/lib/invoices';
import { readBool, readDate, readEnum, readId, readMoney, readText, sendApiError, ValidationError } from '@/lib/validate';

function readInput(body: Record<string, unknown>): MilestoneInput {
  const requiresPayment = readBool(body.requiresPayment ?? false, 'requiresPayment');
  const amount = readMoney(body.amount ?? '0', 'amount', { label: 'Amount' });
  if (requiresPayment && amount === 0) throw new ValidationError('amount', 'A milestone that needs paying needs an amount');
  return {
    title: readText(body.title, 'title', { label: 'Title', max: 150, required: true }),
    description: readText(body.description, 'description', { label: 'Description', max: 3000, multiline: true }),
    amount,
    requiresPayment,
    dueDate: readDate(body.dueDate, 'dueDate', { label: 'Target date' }) || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    if (req.method === 'POST') {
      const projectId = readId(body.projectId, 'projectId');
      if (!GetProject(projectId)) return res.status(404).json({ ok: false, error: 'Project not found' });
      return res.status(200).json({ ok: true, id: InsertMilestone(projectId, readInput(body)) });
    }

    const milestone = GetMilestone(readId(body.id));
    if (!milestone) return res.status(404).json({ ok: false, error: 'Milestone not found' });
    const project = GetProject(milestone.projectId)!;

    switch (req.method) {
      case 'PUT': {
        const input = readInput(body);
        if (!input.requiresPayment && milestone.status === 'awaiting_payment') {
          throw new ValidationError('requiresPayment', 'This milestone is waiting for payment. Confirm or cancel the payment request first.');
        }
        UpdateMilestone(milestone.id, input);
        break;
      }
      case 'PATCH': {
        if (body.move === 'up' || body.move === 'down') {
          if (ListMilestones(project.id).some((m) => m.status !== 'upcoming')) {
            throw new ValidationError('move', 'Milestones can only be reordered before work starts, so payment references stay the same.');
          }
          MoveMilestone(milestone.id, body.move);
          break;
        }

        const action = readEnum(body.action, 'action', ['start', 'request_payment', 'confirm_payment', 'complete', 'reset'] as const, 'Action');
        const now = new Date().toISOString();

        if (action === 'start') {
          const blocker = startBlocker(project, milestone.id);
          if (blocker) throw new ValidationError('action', blocker);
          SetMilestoneStatus(milestone.id, 'in_progress');
        } else if (action === 'request_payment') {
          if (!milestone.requiresPayment) throw new ValidationError('action', "This milestone isn't marked as needing payment");
          if (milestone.paidAt) throw new ValidationError('action', 'This milestone has already been paid');
          SetMilestoneStatus(milestone.id, 'awaiting_payment', { paymentRequestedAt: now });
          const view = describeMilestones(project, ListMilestones(project.id)).find((m) => m.id === milestone.id)!;
          const invoiceId = issueMilestoneInvoice(project, milestone, view.paymentReference);
          await notifyPaymentRequested(project, view, GetInvoice(invoiceId));
        } else if (action === 'confirm_payment') {
          // A bank transfer you've seen arrive; card payments are confirmed by Stripe automatically
          if (!milestone.requiresPayment) throw new ValidationError('action', "This milestone isn't marked as needing payment");
          if (milestone.paidAt) throw new ValidationError('action', 'This milestone has already been paid');
          await recordPayment(project, milestone, { method: 'bank' });
        } else if (action === 'complete') {
          // On pay-after jobs, milestones that need paying are completed by confirming the payment
          if (milestone.requiresPayment && !milestone.paidAt) throw new ValidationError('action', 'Request and confirm the payment to complete this milestone');
          SetMilestoneStatus(milestone.id, 'complete');
        } else {
          // Withdraws a payment request sent by mistake
          if (milestone.paidAt) throw new ValidationError('action', 'This milestone has been paid, so its request can’t be withdrawn');
          // Pay-after stages were being worked on when the request went out
          const back = project.paymentTiming === 'after' && !isDeposit(ListMilestones(project.id), milestone) ? 'in_progress' : 'upcoming';
          SetMilestoneStatus(milestone.id, back, { paymentRequestedAt: null, paymentReportedAt: null });
          voidMilestoneInvoice(milestone.id);
        }
        break;
      }
      case 'DELETE':
        if (milestone.paidAt) throw new ValidationError('id', 'This milestone has a recorded payment, so it is kept.');
        DeleteMilestone(milestone.id);
        break;
      default:
        return res.status(405).end();
    }
    TouchProject(project.id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
