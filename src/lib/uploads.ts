/*
 * @name: Uploads
 * @description: Stores admin image uploads. Every image is decoded, resized and re-encoded as WebP under a random name,
 * so nothing a browser uploads is ever served back byte-for-byte (no SVG/HTML smuggling, no EXIF/GPS data).
 * */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// turbopackIgnore: these are runtime paths, so the build mustn't try to trace what they point at
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'uploads');
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 2000;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);

const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
const UPLOAD_SRC = /^\/uploads\/([0-9a-f-]{36}\.webp)$/;

export class UploadError extends Error {}

export function isUploadFileName(name: string) {
  return FILE_NAME.test(name);
}

// "/uploads/<uuid>.webp" → absolute path on disk, or null for anything else
export function uploadPath(src: string) {
  const match = UPLOAD_SRC.exec(src);
  return match && isUploadFileName(match[1]) ? path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, match[1]) : null;
}

export async function saveImage(input: Buffer) {
  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: 50_000_000 }).metadata()).format;
  } catch {
    throw new UploadError("That file isn't an image we can read.");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new UploadError('Please upload a JPEG, PNG, WebP or AVIF image.');
  }

  fs.mkdirSync(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
  const fileName = `${randomUUID()}.webp`;
  const info = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate() // apply the camera orientation before EXIF is dropped
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, fileName));

  return { src: `/uploads/${fileName}`, width: info.width, height: info.height };
}

// Reads the real dimensions of an uploaded image, or null if it doesn't exist
export async function readUploadedImage(src: string) {
  const file = uploadPath(src);
  if (!file || !fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  const { width, height } = await sharp(file).metadata();
  return width && height ? { src, width, height } : null;
}
