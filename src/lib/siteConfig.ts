/*
 * @name: Site config file
 * @description: Optional config/site.json with starting values for any setting. Handy for keeping a site's details
 * in git or deploying several sites from one codebase. Values saved in the admin always win over this file.
 * */

import fs from 'fs';
import path from 'path';
import { isSettingKey, type SettingKey } from './siteSettings';

const CONFIG_FILE = process.env.SITE_CONFIG || path.join(/*turbopackIgnore: true*/ process.cwd(), 'config', 'site.json');

let cached: Partial<Record<SettingKey, string>> | null = null;

export function configDefaults() {
  if (cached) return cached;
  cached = {};
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ CONFIG_FILE, 'utf8'));
      for (const [key, value] of Object.entries(raw)) {
        // Unknown keys and non-text values are ignored rather than breaking the site
        if (isSettingKey(key) && (typeof value === 'string' || typeof value === 'number')) cached[key] = String(value);
        else if (!key.startsWith('$')) console.warn(`[site config] Ignoring "${key}" in ${CONFIG_FILE}`);
      }
    }
  } catch (err) {
    console.error(`[site config] Could not read ${CONFIG_FILE}:`, err);
  }
  return cached;
}
