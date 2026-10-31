/*
 * @name: requireAdmin
 * @description: Guard for Pages Router API routes. Returns false and sends a 401 if there is no valid admin session.
 * */

import type { NextApiRequest, NextApiResponse } from 'next';
import { SESSION_COOKIE, verifySessionToken } from './auth';

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  if (await verifySessionToken(req.cookies[SESSION_COOKIE])) return true;
  res.status(401).json({ ok: false, error: 'Unauthorised' });
  return false;
}
