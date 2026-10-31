import fs from 'fs/promises';
import path from 'path';
import { isUploadFileName, UPLOAD_DIR } from '@/lib/uploads';

// Serves processed uploads from the persistent volume. Files are named by random UUID and never change, so they cache forever.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!isUploadFileName(file)) return new Response('Not found', { status: 404 });

  try {
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file));
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
