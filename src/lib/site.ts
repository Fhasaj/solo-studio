/*
 * @name: Site
 * @description: The public address of the site and helpers for building absolute URLs (canonical links, sitemap, emails).
 * */

export const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
export const SITE_HOST = new URL(SITE_URL).host;

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
