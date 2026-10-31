import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import formidable from 'formidable';
import { requireAdmin } from '@/lib/requireAdmin';
import { GetProject, InsertHandoverFile } from '@/lib/query/clients.query';
import { MAX_HANDOVER_BYTES, safeFileName, storeHandoverFile } from '@/lib/handover';

// Deliberately outside /api/admin: proxy.ts buffers request bodies in memory (10 MB cap), which large code archives
// would exceed. requireAdmin below is the guard here.
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).end();

  const form = formidable({ maxFiles: 1, maxFields: 1, maxFileSize: MAX_HANDOVER_BYTES, maxTotalFileSize: MAX_HANDOVER_BYTES, allowEmptyFiles: false });
  let tmp: string | undefined;
  try {
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    tmp = file?.filepath;
    const project = GetProject(Number(fields.projectId?.[0]));
    if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
    if (!file) return res.status(400).json({ ok: false, error: 'Choose a file to upload' });

    const { storedName, sha256 } = await storeHandoverFile(file.filepath);
    const id = InsertHandoverFile({ projectId: project.id, fileName: safeFileName(file.originalFilename ?? ''), storedName, size: file.size, sha256 });
    return res.status(200).json({ ok: true, id, sha256 });
  } catch (err) {
    const httpCode = (err as { httpCode?: unknown }).httpCode;
    if (httpCode === 413) return res.status(413).json({ ok: false, error: 'Files must be 100 MB or smaller. For bigger projects, share a repository instead.' });
    if (typeof httpCode === 'number') return res.status(400).json({ ok: false, error: 'That upload could not be read.' });
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Upload failed' });
  } finally {
    // formidable's temporary copy is unencrypted, so it goes straight away
    if (tmp) await fs.unlink(tmp).catch(() => {});
  }
}
