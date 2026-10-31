import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { DeleteExpense, GetExpense, InsertExpense, UpdateExpense } from '@/lib/query/finance.query';
import { readExpense } from '@/lib/expenseInput';
import { deleteHandoverFile, RECEIPTS_DIR } from '@/lib/handover';
import { readId, sendApiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};
  try {
    if (req.method === 'POST') return res.status(200).json({ ok: true, id: InsertExpense(readExpense(body)) });
    const expense = GetExpense(readId(body.id));
    if (!expense) return res.status(404).json({ ok: false, error: 'Expense not found' });
    if (req.method === 'PUT') {
      UpdateExpense(expense.id, readExpense(body));
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      DeleteExpense(expense.id);
      if (expense.receiptStoredName) deleteHandoverFile(expense.receiptStoredName, RECEIPTS_DIR);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
