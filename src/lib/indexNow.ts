/*
 * @name: IndexNow
 * @description: Tells Bing (which ChatGPT search relies on), Yandex and others straight away when a page changes,
 * instead of waiting for them to crawl. Fire-and-forget: failures are only logged.
 * */

import { createHash } from 'crypto';
import { absoluteUrl, SITE_URL } from './site';

// A stable key derived from SECRET_KEY unless one is set; served at /indexnow.txt to prove the site is ours
export function indexNowKey() {
  return process.env.INDEXNOW_KEY || createHash('sha256').update(`indexnow:${process.env.SECRET_KEY ?? ''}`).digest('hex').slice(0, 32);
}

export function pingIndexNow(paths: string[]) {
  const host = new URL(SITE_URL).hostname;
  // Only the live site: pinging from development would point search engines at nothing
  if (process.env.NODE_ENV !== 'production' || host === 'localhost' || !paths.length) return;
  fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: indexNowKey(), keyLocation: absoluteUrl('/indexnow.txt'), urlList: [...new Set(paths)].map((p) => absoluteUrl(p)) }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok && res.status !== 202) console.warn(`[indexnow] ${res.status} for ${paths.join(', ')}`);
    })
    .catch((err) => console.warn('[indexnow] ping failed:', err.message));
}
