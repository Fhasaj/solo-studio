import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import {
  GetBankTransaction,
  InsertBankTransactions,
  InsertExpense,
  InsertOtherIncome,
  ListBankTransactions,
  ListUnpaidInvoices,
  SetBankTransactionMatch,
} from '@/lib/query/finance.query';
import { GetInvoice, GetMilestone, GetProject } from '@/lib/query/clients.query';
import { guessCategory, parseStatement } from '@/lib/bankImport';
import { recordPayment } from '@/lib/portal';
import { payHostingInvoice } from '@/lib/invoices';
import { readExpense } from '@/lib/expenseInput';
import { readEnum, readId, readText, sendApiError, ValidationError } from '@/lib/validate';

// Statements can be large; the default JSON limit is 1 MB
export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

// Unpaid invoices this money-in line could be, best first: the reference or invoice number in the description wins
function suggestInvoices(description: string, amount: number) {
  const text = description.toUpperCase().replace(/\s+/g, '');
  return ListUnpaidInvoices()
    .map((invoice) => {
      const data = JSON.parse(invoice.data);
      const reference = String(data.paymentReference ?? '').toUpperCase().replace(/\s+/g, '');
      const mentioned = text.includes(invoice.number.replace(/\s+/g, '')) || (reference && text.includes(reference));
      const score = (mentioned ? 2 : 0) + (invoice.total === amount ? 1 : 0);
      return { id: invoice.id, number: invoice.number, total: invoice.total, clientName: invoice.clientName, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};
  try {
    if (req.method === 'GET') {
      const status = req.query.status === 'all' ? 'all' : 'new';
      const data = ListBankTransactions(status).map((tx) => ({
        ...tx,
        suggestions: tx.status === 'new' && tx.amount > 0 ? suggestInvoices(tx.description, tx.amount) : [],
        category: tx.amount < 0 ? guessCategory(tx.description) : null,
      }));
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === 'POST') {
      // A CSV statement, as text
      const csv = readText(body.csv, 'csv', { label: 'Statement', max: 5_000_000, required: true, multiline: true });
      let parsed;
      try {
        parsed = parseStatement(csv);
      } catch (err) {
        throw new ValidationError('csv', (err as Error).message);
      }
      const added = InsertBankTransactions(parsed.transactions);
      return res.status(200).json({ ok: true, data: { read: parsed.transactions.length, added, duplicates: parsed.transactions.length - added, skipped: parsed.skipped } });
    }

    if (req.method === 'PATCH') {
      const tx = GetBankTransaction(readId(body.id));
      if (!tx) return res.status(404).json({ ok: false, error: 'Transaction not found' });
      const action = readEnum(body.action, 'action', ['invoice', 'expense', 'income', 'transfer', 'personal', 'ignore', 'reset'] as const, 'Action');
      if (tx.status !== 'new' && action !== 'reset') throw new ValidationError('action', 'This line has already been dealt with. Undo it first.');

      if (action === 'invoice') {
        // Money in that pays an invoice: records the payment exactly as the "confirm payment" button does
        if (tx.amount <= 0) throw new ValidationError('action', 'Only money coming in can pay an invoice');
        const invoice = GetInvoice(readId(body.invoiceId, 'invoiceId'));
        const project = invoice && GetProject(invoice.projectId);
        if (!invoice || !project || invoice.status !== 'unpaid') throw new ValidationError('invoiceId', 'That invoice is not waiting for payment');
        if (invoice.kind === 'hosting') payHostingInvoice(project, invoice);
        else {
          const milestone = invoice.milestoneId ? GetMilestone(invoice.milestoneId) : null;
          if (!milestone) throw new ValidationError('invoiceId', 'That invoice has no milestone');
          await recordPayment(project, milestone, { method: 'bank' });
        }
        SetBankTransactionMatch(tx.id, 'matched', 'invoice', invoice.id);
      } else if (action === 'expense') {
        if (tx.amount >= 0) throw new ValidationError('action', 'Only money going out can be an expense');
        const id = InsertExpense(readExpense({ ...body, date: tx.date, amount: String(-tx.amount / 100), supplier: body.supplier ?? tx.description.slice(0, 120) }));
        SetBankTransactionMatch(tx.id, 'matched', 'expense', id);
      } else if (action === 'income') {
        if (tx.amount <= 0) throw new ValidationError('action', 'Only money coming in can be income');
        const id = InsertOtherIncome({ date: tx.date, description: readText(body.description ?? tx.description, 'description', { label: 'Description', max: 200, required: true }), amount: tx.amount, vat: 0 });
        SetBankTransactionMatch(tx.id, 'matched', 'income', id);
      } else if (action === 'reset') {
        // Only lines you set aside can be undone here; matched invoices and expenses are undone where they were recorded
        if (tx.status === 'matched' && (tx.matchType === 'invoice' || tx.matchType === 'expense' || tx.matchType === 'income')) {
          throw new ValidationError('action', `Undo this from the ${tx.matchType} itself.`);
        }
        SetBankTransactionMatch(tx.id, 'new', null, null);
      } else {
        // Transfers between your own accounts and personal spending aren't business income or costs
        SetBankTransactionMatch(tx.id, action === 'ignore' ? 'ignored' : 'matched', action === 'ignore' ? null : action, null);
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
