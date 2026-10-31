/*
 * @name: Secure store
 * @description: AES-256-GCM encryption for sensitive values kept in the database (bank details).
 * A stolen database file or backup is useless without the key, which lives only in the environment.
 * */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

export function getKey() {
  // A dedicated key is best; otherwise one is derived from SECRET_KEY so the site still works
  const dedicated = process.env.DATA_ENCRYPTION_KEY;
  if (dedicated) {
    const key = Buffer.from(dedicated, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)');
    return key;
  }
  const secret = process.env.SECRET_KEY;
  if (!secret || secret.length < 32) throw new Error('Set DATA_ENCRYPTION_KEY (or SECRET_KEY) to store bank details');
  return Buffer.from(hkdfSync('sha256', secret, 'solo-studio', 'secure-store-v1', 32));
}

// Format: v1.<iv>.<auth tag>.<ciphertext>, each base64url
export function encryptValue(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptValue(stored: string) {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Unreadable encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
