/*
 * @name: requireClient
 * @description: Guard for client-portal API routes. Returns the signed-in, active client, or sends a 401 and returns null.
 * Routes must still check that anything they touch belongs to this client.
 * */

import type { NextApiRequest, NextApiResponse } from 'next';
import { CLIENT_COOKIE, verifyClientSessionToken } from './auth';
import { GetClient } from './query/clients.query';

export async function requireClient(req: NextApiRequest, res: NextApiResponse) {
  const clientId = await verifyClientSessionToken(req.cookies[CLIENT_COOKIE]);
  const client = clientId ? GetClient(clientId) : null;
  if (client?.isActive) return client;
  res.status(401).json({ ok: false, error: 'Please sign in again.' });
  return null;
}
