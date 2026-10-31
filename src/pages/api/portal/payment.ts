import type { NextApiRequest, NextApiResponse } from 'next';
import { requireClient } from '@/lib/requireClient';
import { GetClientProject, GetMilestone, ListMilestones, ReportMilestonePayment } from '@/lib/query/clients.query';
import { describeMilestones, notifyPaymentReported } from '@/lib/portal';
import { readId, sendApiError } from '@/lib/validate';

// The client says they've sent a bank transfer. Only the admin can mark it as paid.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const client = await requireClient(req, res);
  if (!client) return;

  try {
    const milestone = GetMilestone(readId(req.body?.milestoneId, 'milestoneId'));
    const project = milestone && GetClientProject(milestone.projectId, client.id);
    if (!milestone || !project) return res.status(404).json({ ok: false, error: 'Not found' });
    if (milestone.status !== 'awaiting_payment' || milestone.paidAt) {
      return res.status(400).json({ ok: false, error: 'No payment is due for this milestone.' });
    }
    if (!milestone.paymentReportedAt) {
      ReportMilestonePayment(milestone.id);
      const view = describeMilestones(project, ListMilestones(project.id)).find((m) => m.id === milestone.id)!;
      await notifyPaymentReported(project, view);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
