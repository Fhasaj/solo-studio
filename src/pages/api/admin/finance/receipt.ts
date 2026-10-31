import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import formidable from 'formidable';
import { requireAdmin } from '@/lib/requireAdmin';
import { GetExpense, SetExpenseReceipt } from '@/lib/query/finance.query';
import { deleteHandoverFile, readHandoverFile, RECEIPTS_DIR, safeFileName, storeHandoverFile } from '@/lib/handover';

// Receipts are kept under the proxy's 10 MB body limit
export const config = { api: { bodyParser: false } };
const MAX_BYTES = 8 * 1024 * 1024;

// The first bytes of the file decide its type, not the name or what the browser claims
function receiptType(head: Buffer) {
  if (head.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (head.subarray(4, 12).toString().startsWith('ftyphei')) return 'image/heic';
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') {
    const expense = GetExpense(Number(req.query.id));
    if (!expense?.receiptStoredName) return res.status(404).json({ ok: false, error: 'No receipt' });
    const { source, decipher } = readHandoverFile(expense.receiptStoredName, RECEIPTS_DIR);
    const name = (expense.receiptName ?? 'receipt').replace(/"/g, '');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.setHeader('Content-Type', name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Shown as a file, never run as a page on this site
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    try {
      if (source) await pipeline(source, decipher, res);
      else res.end(decipher.final());
    } catch {
      res.destroy();
    }
    return;
  }

  if (req.method !== 'POST') return res.status(405).end();
  const form = formidable({ maxFiles: 1, maxFields: 1, maxFileSize: MAX_BYTES, allowEmptyFiles: false });
  let tmp: string | undefined;
  try {
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    tmp = file?.filepath;
    const expense = GetExpense(Number(fields.expenseId?.[0]));
    if (!expense) return res.status(404).json({ ok: false, error: 'Expense not found' });
    if (!file) return res.status(400).json({ ok: false, error: 'Choose a receipt' });
    const head = Buffer.alloc(16);
    const handle = await fs.open(file.filepath, 'r');
    await handle.read(head, 0, 16, 0);
    await handle.close();
    if (!receiptType(head)) return res.status(400).json({ ok: false, error: 'Receipts must be a PDF, JPEG, PNG, WebP or HEIC file.' });

    const { storedName } = await storeHandoverFile(file.filepath, RECEIPTS_DIR);
    if (expense.receiptStoredName) deleteHandoverFile(expense.receiptStoredName, RECEIPTS_DIR);
    SetExpenseReceipt(expense.id, storedName, safeFileName(file.originalFilename ?? 'receipt'));
    return res.status(200).json({ ok: true });
  } catch (err) {
    const httpCode = (err as { httpCode?: unknown }).httpCode;
    if (httpCode === 413) return res.status(413).json({ ok: false, error: 'Receipts must be 8 MB or smaller.' });
    if (typeof httpCode === 'number') return res.status(400).json({ ok: false, error: 'That upload could not be read.' });
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Upload failed' });
  } finally {
    if (tmp) await fs.unlink(tmp).catch(() => {});
  }
}
