import type { NextApiRequest, NextApiResponse } from 'next';
import { GetSectionVisibility, SetSectionVisibility } from '@/lib/query/settings.query';
import { requireAdmin } from '@/lib/requireAdmin';
import { isSectionKey } from '@/lib/sections';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, data: GetSectionVisibility() });
  }

  if (req.method !== 'PUT') return res.status(405).end();
  if (!(await requireAdmin(req, res))) return;

  const { key, isVisible } = req.body ?? {};
  if (!isSectionKey(key) || typeof isVisible !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'Invalid section or value' });
  }

  try {
    SetSectionVisibility(key, isVisible);
    return res.status(200).json({ ok: true, data: GetSectionVisibility() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'DB error' });
  }
}
