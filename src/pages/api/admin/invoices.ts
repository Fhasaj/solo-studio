import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { GetClient, GetInvoice, GetProject, VoidInvoice } from '@/lib/query/clients.query';
import { issueHostingInvoice, payHostingInvoice } from '@/lib/invoices';
import { sendMail } from '@/lib/mailer';
import { absoluteUrl } from '@/lib/site';
import { formatDate, formatPence } from '@/lib/format';
import { GetSiteSettings } from '@/lib/query/settings.query';
import { readEnum, readId, readInt, sendApiError, ValidationError } from '@/lib/validate';

// Hosting invoices. Milestone invoices are issued, paid and voided by the milestone actions.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    if (req.method === 'POST') {
      const project = GetProject(readId(body.projectId, 'projectId'));
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (!project.hostingMonthly) throw new ValidationError('months', 'This job has no hosting fee. Add its hosting costs first.');
      const months = readInt(body.months, 'months', { label: 'Months', min: 1, max: 24 });
      const invoice = GetInvoice(issueHostingInvoice(project, months))!;
      const client = GetClient(project.clientId);
      if (client) {
        await sendMail({
          to: client.email,
          replyTo: GetSiteSettings().contactEmail || undefined,
          subject: `Invoice ${invoice.number}: hosting for ${project.title}`,
          text: [
            `Hi ${client.name},`,
            '',
            `Here is your hosting invoice for ${project.title}: ${formatPence(invoice.total)}, due by ${formatDate(invoice.dueAt)}.`,
            '',
            `View and print it, with the bank details to pay, in your client portal: ${absoluteUrl(`/portal/invoices/${invoice.id}`)}`,
            `Please use the reference ${invoice.data.paymentReference}.`,
            '',
            'Thanks,',
            GetSiteSettings().ownerName,
          ].join('\n'),
        });
      }
      return res.status(200).json({ ok: true, id: invoice.id });
    }

    if (req.method === 'PATCH') {
      const invoice = GetInvoice(readId(body.id));
      const project = invoice && GetProject(invoice.projectId);
      if (!invoice || !project) return res.status(404).json({ ok: false, error: 'Invoice not found' });
      if (invoice.kind !== 'hosting') throw new ValidationError('id', "Milestone invoices are paid or withdrawn from the milestone itself.");
      const action = readEnum(body.action, 'action', ['paid', 'void'] as const, 'Action');
      if (action === 'paid' && !payHostingInvoice(project, invoice)) throw new ValidationError('id', 'Only unpaid invoices can be marked paid');
      if (action === 'void' && !VoidInvoice(invoice.id)) throw new ValidationError('id', 'Only unpaid invoices can be voided');
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
