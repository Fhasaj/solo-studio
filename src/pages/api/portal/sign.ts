import type { NextApiRequest, NextApiResponse } from 'next';
import { requireClient } from '@/lib/requireClient';
import { GetClientProject, GetContract, MarkContractSigned } from '@/lib/query/clients.query';
import { contractHash, notifyContractSigned } from '@/lib/portal';
import { clientIp } from '@/lib/rateLimit';
import { readBool, readText, readId, sendApiError, ValidationError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const client = await requireClient(req, res);
  if (!client) return;
  const body = req.body ?? {};

  try {
    const contract = GetContract(readId(body.contractId, 'contractId'));
    const project = contract && GetClientProject(contract.projectId, client.id);
    if (!contract || !project) return res.status(404).json({ ok: false, error: 'Not found' });
    if (contract.status !== 'sent') return res.status(400).json({ ok: false, error: 'This contract is not waiting for a signature.' });

    const name = readText(body.name, 'name', { label: 'Your full name', max: 120, required: true });
    if (!readBool(body.agree ?? false, 'agree')) throw new ValidationError('agree', 'Tick the box to confirm you agree');
    // The page sends the fingerprint of the text it showed, so the signature is tied to that exact text
    const shownHash = readText(body.bodyHash, 'bodyHash', { label: 'Contract', max: 64, required: true });
    if (shownHash !== contract.bodyHash || contractHash(contract.body) !== contract.bodyHash) {
      return res.status(409).json({ ok: false, error: 'This contract has changed since you opened it. Please reload the page.' });
    }

    const changed = MarkContractSigned(contract.id, shownHash, {
      name,
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
    });
    if (!changed) return res.status(409).json({ ok: false, error: 'This contract could not be signed. Please reload the page.' });

    await notifyContractSigned(project, GetContract(contract.id)!);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
