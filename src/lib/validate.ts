/*
 * @name: Validation
 * @description: Server-side input checks shared by the API routes. Every value from a request goes through one of these.
 * */

import type { NextApiResponse } from 'next';

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

// Control characters other than tab and newline have no business in content
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

interface TextOptions {
  label: string;
  max?: number;
  required?: boolean;
  multiline?: boolean;
}

export function readText(value: unknown, field: string, { label, max = 200, required = false, multiline = false }: TextOptions) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new ValidationError(field, `${label} must be text`);
  }
  let text = String(value ?? '').replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '');
  text = multiline ? text.trim() : text.replace(/\s+/g, ' ').trim();
  if (required && !text) throw new ValidationError(field, `${label} is required`);
  if (text.length > max) throw new ValidationError(field, `${label} must be ${max} characters or fewer`);
  return text;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function readEmail(value: unknown, field: string, { label = 'Email', required = true } = {}) {
  const email = readText(value, field, { label, max: 254, required }).toLowerCase();
  if (email && !EMAIL.test(email)) throw new ValidationError(field, `${label} doesn't look like an email address`);
  return email;
}

export function readUrl(value: unknown, field: string, { label, required = false }: { label: string; required?: boolean }) {
  const url = readText(value, field, { label, max: 500, required });
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
  } catch {
    throw new ValidationError(field, `${label} must be a full web address starting with https://`);
  }
  return url;
}

export function readInt(value: unknown, field: string, { label, min, max }: { label: string; min: number; max: number }) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(field, `${label} must be a whole number between ${min} and ${max}`);
  }
  return number;
}

export function readId(value: unknown, field = 'id') {
  return readInt(value, field, { label: 'ID', min: 1, max: Number.MAX_SAFE_INTEGER });
}

export function readOptionalId(value: unknown, field: string) {
  return value === undefined || value === null || value === '' ? null : readId(value, field);
}

export function readBool(value: unknown, field: string) {
  if (typeof value !== 'boolean') throw new ValidationError(field, `${field} must be true or false`);
  return value;
}

export function readEnum<T extends string>(value: unknown, field: string, options: readonly T[], label = field): T {
  if (typeof value !== 'string' || !options.includes(value as T)) {
    throw new ValidationError(field, `${label} must be one of: ${options.join(', ')}`);
  }
  return value as T;
}

// YYYY-MM-DD that is a real calendar date
export function readDate(value: unknown, field: string, { label, required = false }: { label: string; required?: boolean }) {
  const text = readText(value, field, { label, max: 10, required });
  if (!text) return '';
  const date = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new ValidationError(field, `${label} must be a date (YYYY-MM-DD)`);
  }
  return text;
}

// "1,250.50" or "£1250" → pence
export function readMoney(value: unknown, field: string, { label }: { label: string }) {
  const text = readText(String(value ?? ''), field, { label, max: 20 }).replace(/[£,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new ValidationError(field, `${label} must be an amount in pounds, e.g. 1250 or 1250.50`);
  const pence = Math.round(Number(text) * 100);
  if (pence > 100_000_000) throw new ValidationError(field, `${label} is too large`);
  return pence;
}

export function sendApiError(res: NextApiResponse, err: unknown) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ ok: false, error: err.message, field: err.field });
  }
  console.error(err);
  return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
}
