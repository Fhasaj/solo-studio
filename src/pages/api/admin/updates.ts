import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { DeleteUpdate, GetProject, InsertUpdate } from '@/lib/query/clients.query';
import { notifyProjectUpdate } from '@/lib/portal';
import { readBool, readId, readText, sendApiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    if (req.method === 'POST') {
      const project = GetProject(readId(body.projectId, 'projectId'));
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      const text = readText(body.body, 'body', { label: 'Update', max: 5000, required: true, multiline: true });
      const id = InsertUpdate(project.id, text);
      if (readBool(body.notify ?? false, 'notify')) await notifyProjectUpdate(project, text);
      return res.status(200).json({ ok: true, id });
    }
    if (req.method === 'DELETE') {
      DeleteUpdate(readId(body.id));
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
