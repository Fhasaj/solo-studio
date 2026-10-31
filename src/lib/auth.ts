/*
 * @name: Auth
 * @description: Signs and verifies the admin and client-portal session cookies. Uses Web Crypto so it works in proxy.ts and API routes.
 * */

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export const CLIENT_COOKIE = "client_session";
export const CLIENT_MAX_AGE = 60 * 60 * 24 * 14; // 14 days, in seconds

const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.SECRET_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("SECRET_KEY must be set and at least 32 characters long");
  }
  return secret;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(signature).toString("base64url");
}

// Compares two strings without leaking where they differ through timing
export function safeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

// Token format: <subject>.<expires>.<signature>. The subject never contains a dot.
async function createToken(subject: string, maxAge: number) {
  const expires = Math.floor(Date.now() / 1000) + maxAge;
  const payload = `${subject}.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

// Returns the subject of a valid, unexpired token, or null
async function verifyToken(token: string | undefined | null) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [subject, expires, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000) return null;

  try {
    return safeEqual(signature, await sign(`${subject}.${expires}`)) ? subject : null;
  } catch {
    return null;
  }
}

export function createSessionToken() {
  return createToken("admin", SESSION_MAX_AGE);
}

export async function verifySessionToken(token: string | undefined | null) {
  return (await verifyToken(token)) === "admin";
}

export function createClientSessionToken(clientId: number) {
  return createToken(`client-${clientId}`, CLIENT_MAX_AGE);
}

// Returns the client id from a valid portal session, or null. Callers must still check the client is active.
export async function verifyClientSessionToken(token: string | undefined | null) {
  const match = /^client-(\d+)$/.exec((await verifyToken(token)) ?? "");
  return match ? Number(match[1]) : null;
}

// Password accepted, waiting for the emailed code
export const PENDING_COOKIE = "admin_pending";
export const PENDING_MAX_AGE = 10 * 60;

export function createPendingToken() {
  return createToken("admin-pending", PENDING_MAX_AGE);
}

export async function verifyPendingToken(token: string | undefined | null) {
  return (await verifyToken(token)) === "admin-pending";
}

// Bank details unlocked with an emailed code, for a short while
export const BANK_UNLOCK_COOKIE = "bank_unlock";
export const BANK_UNLOCK_MAX_AGE = 10 * 60;

export function createBankUnlockToken() {
  return createToken("bank-unlock", BANK_UNLOCK_MAX_AGE);
}

export async function verifyBankUnlockToken(token: string | undefined | null) {
  return (await verifyToken(token)) === "bank-unlock";
}

export function sessionCookie(name: string, value: string, maxAge: number, sameSite: "Strict" | "Lax", path = "/") {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`;
}
