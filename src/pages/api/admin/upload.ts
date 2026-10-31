import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import formidable from 'formidable';
import { requireAdmin } from '@/lib/requireAdmin';
import { MAX_UPLOAD_BYTES, saveImage, UploadError } from '@/lib/uploads';

// formidable reads the multipart body itself
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).end();

  const form = formidable({
    maxFiles: 1,
    maxFileSize: MAX_UPLOAD_BYTES,
    maxFields: 0,
    allowEmptyFiles: false,
    // A first filter only: the real check is decoding the file in saveImage
    filter: ({ mimetype }) => Boolean(mimetype?.startsWith('image/')),
  });

  let path: string | undefined;
  try {
    const [, files] = await form.parse(req);
    const file = files.file?.[0];
    if (!file) return res.status(400).json({ ok: false, error: 'Choose an image to upload (JPEG, PNG, WebP or AVIF).' });
    path = file.filepath;
    const image = await saveImage(await fs.readFile(file.filepath));
    return res.status(200).json({ ok: true, data: image });
  } catch (err) {
    if (err instanceof UploadError) return res.status(400).json({ ok: false, error: err.message });
    // formidable's error classes aren't exported reliably, but its errors carry the HTTP status to use
    const httpCode = (err as { httpCode?: unknown }).httpCode;
    if (typeof httpCode === 'number') {
      const tooBig = httpCode === 413;
      return res.status(tooBig ? 413 : 400).json({ ok: false, error: tooBig ? 'Images must be 8 MB or smaller.' : 'That upload could not be read.' });
    }
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Upload failed' });
  } finally {
    if (path) await fs.unlink(path).catch(() => {});
  }
}
