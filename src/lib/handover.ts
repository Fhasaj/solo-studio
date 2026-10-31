/*
 * @name: Code handover
 * @description: The final code and documents for a client, stored encrypted (AES-256-GCM) in a private folder that is
 * never served directly. Clients can only download them through the portal, once the final payment is in.
 * */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { DB_DIR } from './dbConnect';
import { getKey } from './secureStore';

// Lives on the database volume, so it's persistent and private in Docker
export const HANDOVER_DIR = process.env.HANDOVER_DIR || path.join(/*turbopackIgnore: true*/ DB_DIR, 'handover');
// Cloudflare refuses uploads over 100 MB; bigger projects should be handed over as a repository
export const MAX_HANDOVER_BYTES = 100 * 1024 * 1024;

const MAGIC = Buffer.from('FHH1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER = MAGIC.length + IV_LENGTH;

function filePath(storedName: string) {
  if (!/^[0-9a-f-]{36}\.bin$/.test(storedName)) throw new Error('Bad handover file name');
  return path.join(/*turbopackIgnore: true*/ HANDOVER_DIR, storedName);
}

// Keeps only safe characters from an uploaded file name, for the download name
export function safeFileName(name: string) {
  const cleaned = path.basename(name).normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return cleaned || 'handover.zip';
}

// Encrypts a file into the handover folder. Returns the stored name and the SHA-256 of the original.
export async function storeHandoverFile(sourcePath: string) {
  fs.mkdirSync(/*turbopackIgnore: true*/ HANDOVER_DIR, { recursive: true, mode: 0o700 });
  const storedName = `${randomUUID()}.bin`;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const hash = createHash('sha256');
  const target = filePath(storedName);
  const out = fs.createWriteStream(target, { mode: 0o600 });
  out.write(Buffer.concat([MAGIC, iv]));

  try {
    await pipeline(
      fs.createReadStream(sourcePath),
      new Transform({
        transform(chunk, _encoding, done) {
          hash.update(chunk);
          done(null, chunk);
        },
      }),
      cipher,
      out
    );
    fs.appendFileSync(target, cipher.getAuthTag());
  } catch (err) {
    fs.rmSync(target, { force: true });
    throw err;
  }
  return { storedName, sha256: hash.digest('hex') };
}

// A stream of the decrypted file. If the stored file was altered, decryption fails and the download aborts.
export function readHandoverFile(storedName: string) {
  const target = filePath(storedName);
  const { size } = fs.statSync(target);
  const fd = fs.openSync(target, 'r');
  const header = Buffer.alloc(HEADER);
  const tag = Buffer.alloc(TAG_LENGTH);
  fs.readSync(fd, header, 0, HEADER, 0);
  fs.readSync(fd, tag, 0, TAG_LENGTH, size - TAG_LENGTH);
  fs.closeSync(fd);
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a handover file');

  const decipher = createDecipheriv('aes-256-gcm', getKey(), header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const body = size - HEADER - TAG_LENGTH;
  const source = body > 0 ? fs.createReadStream(target, { start: HEADER, end: HEADER + body - 1 }) : null;
  return { source, decipher };
}

export function deleteHandoverFile(storedName: string) {
  fs.rmSync(filePath(storedName), { force: true });
}
