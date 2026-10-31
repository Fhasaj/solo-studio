/*
 * @name: Rate limiting
 * @description: In-memory fixed-window limits for public endpoints (contact form, bookings, portal login).
 * Per process only, which is fine for the single container this site runs in.
 * */

import type { NextApiRequest } from 'next';

// Cloudflare sets cf-connecting-ip to the real visitor IP. The first X-Forwarded-For
// entry is sent by the visitor, so it can be faked to dodge limits.
export function clientIp(req: NextApiRequest) {
  const cloudflareIp = req.headers['cf-connecting-ip'];
  const ip = Array.isArray(cloudflareIp) ? cloudflareIp[0] : cloudflareIp;
  return ip?.trim() || req.socket.remoteAddress || 'unknown';
}

export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    // Records a hit and returns false once the key is over the limit
    take(key: string) {
      const now = Date.now();
      if (hits.size > 10_000) {
        for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
      }
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
  };
}
