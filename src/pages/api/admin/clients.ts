import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import {
  ClientHasProjects,
  DeleteClient,
  GetClient,
  GetClientByEmail,
  InsertClient,
  ListClients,
  ListProjects,
  UpdateClient,
  type ClientInput,
} from '@/lib/query/clients.query';
import { GetBooking, LinkBookingToClient } from '@/lib/query/bookings.query';
import { sendLoginLink } from '@/lib/portal';
import { readBool, readEmail, readEnum, readId, readOptionalId, readText, sendApiError, ValidationError } from '@/lib/validate';
import { CLIENT_COUNTRIES } from '@/lib/vat';

function readInput(body: Record<string, unknown>, id: number | null): ClientInput {
  const email = readEmail(body.email, 'email');
  const existing = GetClientByEmail(email);
  if (existing && existing.id !== id) throw new ValidationError('email', `${existing.name} already uses that email`);
  return {
    name: readText(body.name, 'name', { label: 'Name', max: 120, required: true }),
    email,
    company: readText(body.company, 'company', { label: 'Company', max: 150 }),
    phone: readText(body.phone, 'phone', { label: 'Phone', max: 30 }),
    address: readText(body.address, 'address', { label: 'Billing address', max: 300, multiline: true }),
    country: body.country ? readEnum(body.country, 'country', CLIENT_COUNTRIES.map(([code]) => code), 'Country') : '',
    vatNumber: readText(body.vatNumber, 'vatNumber', { label: 'VAT number', max: 20 }).toUpperCase().replace(/\s/g, ''),
    notes: readText(body.notes, 'notes', { label: 'Notes', max: 5000, multiline: true }),
    isActive: readBool(body.isActive ?? true, 'isActive'),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    switch (req.method) {
      case 'GET': {
        if (req.query.id) {
          const client = GetClient(readId(req.query.id));
          if (!client) return res.status(404).json({ ok: false, error: 'Not found' });
          return res.status(200).json({ ok: true, data: { client, projects: ListProjects(client.id) } });
        }
        return res.status(200).json({ ok: true, data: ListClients() });
      }
      case 'POST': {
        const bookingId = readOptionalId(body.bookingId, 'bookingId');
        const id = InsertClient(readInput(body, null));
        if (bookingId && GetBooking(bookingId)) LinkBookingToClient(bookingId, id);
        return res.status(200).json({ ok: true, id });
      }
      case 'PUT': {
        const id = readId(body.id);
        if (!GetClient(id)) return res.status(404).json({ ok: false, error: 'Not found' });
        UpdateClient(id, readInput(body, id));
        return res.status(200).json({ ok: true });
      }
      case 'PATCH': {
        // Sends the client an invite with a sign-in link to the portal
        const client = GetClient(readId(body.id));
        if (!client) return res.status(404).json({ ok: false, error: 'Not found' });
        if (!client.isActive) throw new ValidationError('isActive', 'This client is switched off. Turn portal access on first.');
        const sent = await sendLoginLink(client, { invite: true });
        return res.status(200).json({ ok: true, sent });
      }
      case 'DELETE': {
        const id = readId(body.id);
        if (ClientHasProjects(id)) throw new ValidationError('id', 'Delete or move their projects first, or switch off portal access instead.');
        DeleteClient(id);
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(405).end();
    }
  } catch (err) {
    return sendApiError(res, err);
  }
}
