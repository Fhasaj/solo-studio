import type { NextApiRequest, NextApiResponse } from 'next';
import { requireClient } from '@/lib/requireClient';
import { GetClientProject, InsertSupportRequest, SUPPORT_PLANS } from '@/lib/query/clients.query';
import { notifySupportRequest } from '@/lib/portal';
import { readEnum, readId, readInt, readText, sendApiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const client = await requireClient(req, res);
  if (!client) return;
  const body = req.body ?? {};

  try {
    const project = GetClientProject(readId(body.projectId, 'projectId'), client.id);
    if (!project) return res.status(404).json({ ok: false, error: 'Not found' });
    const plan = readEnum(body.plan, 'plan', SUPPORT_PLANS, 'Plan');
    const months = readInt(body.months, 'months', { label: 'Months', min: 1, max: 24 });
    const message = readText(body.message, 'message', { label: 'Message', max: 2000, multiline: true });
    InsertSupportRequest(project.id, plan, months, message);
    await notifySupportRequest(project, plan, months, message);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
