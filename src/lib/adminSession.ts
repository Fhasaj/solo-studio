/*
 * @name: Admin session and password
 * @description: The admin password (set in the admin, or ADMIN_PASSWORD until then), hashed with scrypt, and session
 * versions so "sign out everywhere" and password changes end every other session.
 * */

import { randomBytes, scryptSync } from 'crypto';
import { safeEqual, sessionVersionOf } from './auth';
import { GetAdminState, SetAdminState } from './query/security.query';

export function currentSessionVersion() {
  return Number(GetAdminState('sessionVersion') ?? 1);
}

export async function isValidAdminToken(token: string | undefined | null) {
  const version = await sessionVersionOf(token);
  return version !== null && version === currentSessionVersion();
}

export function endAllSessions() {
  const next = currentSessionVersion() + 1;
  SetAdminState('sessionVersion', String(next));
  return next;
}

// scrypt$<salt>$<hash>
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('base64url')}`;
}

export function checkPassword(password: string) {
  const stored = GetAdminState('passwordHash');
  if (stored) {
    const [, salt, hash] = stored.split('$');
    return safeEqual(scryptSync(password, salt, 64).toString('base64url'), hash);
  }
  const fromEnv = process.env.ADMIN_PASSWORD;
  return Boolean(fromEnv) && safeEqual(password, fromEnv!);
}

export function passwordSource() {
  return GetAdminState('passwordHash') ? { source: 'admin' as const, changedAt: GetAdminState('passwordChangedAt') } : { source: 'env' as const, changedAt: null };
}

export function setPassword(password: string) {
  SetAdminState('passwordHash', hashPassword(password));
  SetAdminState('passwordChangedAt', new Date().toISOString());
}

// At least 12 characters and not one of the obvious ones
export function passwordProblem(password: string) {
  if (password.length < 12) return 'Use at least 12 characters. A few random words work well.';
  if (password.length > 200) return 'That password is too long.';
  if (/^(.)\1+$/.test(password) || /^(password|123456|qwerty)/i.test(password)) return 'Choose something harder to guess.';
  return null;
}
