/*
 * @name: Sessions for server components
 * @description: Reads the admin and client sessions inside App Router pages. proxy.ts already guards these routes;
 * pages check again so a matcher mistake can never expose data.
 * */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CLIENT_COOKIE, SESSION_COOKIE, verifyClientSessionToken, verifySessionToken } from './auth';
import { GetClient } from './query/clients.query';

export async function isAdminSession() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function getPortalClient() {
  const clientId = await verifyClientSessionToken((await cookies()).get(CLIENT_COOKIE)?.value);
  const client = clientId ? GetClient(clientId) : null;
  return client?.isActive ? client : null;
}

export async function requirePortalClient() {
  const client = await getPortalClient();
  if (!client) redirect('/portal/login');
  return client;
}
