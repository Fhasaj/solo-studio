import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { DeleteHandoverFile, GetHandoverFile, GetProject, UpdateHandoverDetails } from '@/lib/query/clients.query';
import { deleteHandoverFile } from '@/lib/handover';
import { readId, readText, readUrl, sendApiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    if (req.method === 'PUT') {
      const project = GetProject(readId(body.projectId, 'projectId'));
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      UpdateHandoverDetails(
        project.id,
        readText(body.notes, 'notes', { label: 'Handover notes', max: 5000, multiline: true }),
        readUrl(body.repoUrl, 'repoUrl', { label: 'Repository link' })
      );
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const file = GetHandoverFile(readId(body.id));
      if (!file) return res.status(404).json({ ok: false, error: 'File not found' });
      DeleteHandoverFile(file.id);
      deleteHandoverFile(file.storedName);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
