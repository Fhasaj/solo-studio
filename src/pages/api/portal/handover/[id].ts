import type { NextApiRequest, NextApiResponse } from 'next';
import { pipeline } from 'stream/promises';
import { requireClient } from '@/lib/requireClient';
import { GetClientProject, GetHandoverFile, ListMilestones, LogHandoverDownload } from '@/lib/query/clients.query';
import { handoverReleased } from '@/lib/portal';
import { readHandoverFile } from '@/lib/handover';
import { clientIp } from '@/lib/rateLimit';

// Download a handover file: signed-in client, their own project, final payment received. Every download is logged.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const client = await requireClient(req, res);
  if (!client) return;

  const file = GetHandoverFile(Number(req.query.id));
  const project = file && GetClientProject(file.projectId, client.id);
  if (!file || !project) return res.status(404).json({ ok: false, error: 'Not found' });
  if (!handoverReleased(ListMilestones(project.id))) {
    return res.status(403).json({ ok: false, error: 'This becomes available once the final payment is received.' });
  }

  LogHandoverDownload(file.id, client.id, clientIp(req));
  const { source, decipher } = readHandoverFile(file.storedName);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/"/g, '')}"`);
  res.setHeader('Content-Length', String(file.size));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (source) await pipeline(source, decipher, res);
    else res.end(decipher.final());
  } catch (err) {
    // Decryption failing means the stored file was altered or the key changed: stop rather than send bad data
    console.error(`[handover] Could not decrypt file ${file.id}:`, err);
    res.destroy();
  }
}
