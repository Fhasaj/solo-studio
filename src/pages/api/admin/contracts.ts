import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import {
  DeleteDraftContract,
  GetClient,
  GetContract,
  GetProject,
  InsertContract,
  MarkContractSent,
  UpdateDraftContract,
  VoidContract,
} from '@/lib/query/clients.query';
import { GetSiteSettings } from '@/lib/query/settings.query';
import { buildContractBody, contractHash, notifyContractSent } from '@/lib/portal';
import { readEnum, readId, readText, sendApiError, ValidationError } from '@/lib/validate';

// Placeholder text the contract template leaves when something is missing, e.g. "[Add your business address in Settings]"
const PLACEHOLDER = /\[[^\]]{3,}\]|\{\{\s*\w+\s*\}\}/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    if (req.method === 'POST') {
      // Creates a draft from the template, filled in for this project
      const project = GetProject(readId(body.projectId, 'projectId'));
      const client = project && GetClient(project.clientId);
      if (!project || !client) return res.status(404).json({ ok: false, error: 'Project not found' });
      const id = InsertContract(project.id, `Software development agreement: ${project.title}`, buildContractBody(project, client));
      return res.status(200).json({ ok: true, id });
    }

    const contract = GetContract(readId(body.id));
    if (!contract) return res.status(404).json({ ok: false, error: 'Contract not found' });
    const project = GetProject(contract.projectId)!;

    switch (req.method) {
      case 'PUT': {
        if (contract.status !== 'draft') throw new ValidationError('body', 'Only drafts can be edited. Void it and create a new one instead.');
        UpdateDraftContract(
          contract.id,
          readText(body.title, 'title', { label: 'Title', max: 200, required: true }),
          readText(body.body, 'body', { label: 'Contract text', max: 60_000, required: true, multiline: true })
        );
        return res.status(200).json({ ok: true });
      }
      case 'PATCH': {
        const action = readEnum(body.action, 'action', ['send', 'void', 'rebuild'] as const, 'Action');
        if (action === 'rebuild') {
          // Re-fills a draft from the current template, settings, client and milestones
          const client = GetClient(project.clientId);
          if (contract.status !== 'draft' || !client) throw new ValidationError('action', 'Only drafts can be rebuilt');
          UpdateDraftContract(contract.id, contract.title, buildContractBody(project, client));
          return res.status(200).json({ ok: true });
        }
        if (action === 'void') {
          if (!VoidContract(contract.id)) throw new ValidationError('action', 'Signed contracts can’t be voided here');
          return res.status(200).json({ ok: true });
        }
        if (contract.status !== 'draft') throw new ValidationError('action', 'This contract has already been sent');
        const missing = PLACEHOLDER.exec(`${contract.title}\n${contract.body}`);
        if (missing) {
          throw new ValidationError(
            'body',
            /Settings/.test(missing[0])
              ? `Fill in "${missing[0]}", then press "Rebuild from template" to update this draft.`
              : `Fill in "${missing[0]}" before sending: edit the draft, or fix it at the source and press "Rebuild from template".`
          );
        }
        // Sending is the Developer's acceptance; the text is frozen from here on
        MarkContractSent(contract.id, contractHash(contract.body), GetSiteSettings().businessName);
        await notifyContractSent(project, contract);
        return res.status(200).json({ ok: true });
      }
      case 'DELETE':
        if (!DeleteDraftContract(contract.id)) throw new ValidationError('id', 'Only drafts can be deleted. Void a sent contract instead.');
        return res.status(200).json({ ok: true });
      default:
        return res.status(405).end();
    }
  } catch (err) {
    return sendApiError(res, err);
  }
}
