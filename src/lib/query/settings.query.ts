import { getDb } from '../dbConnect';
import { runMigrations } from '../migrate';
import { SECTION_DEFAULTS, type SectionKey, type SectionVisibility } from '../sections';
import { SETTING_DEFAULTS, isSettingKey, type SettingKey, type SiteSettings } from '../siteSettings';
import { configDefaults, configSectionDefaults } from '../siteConfig';

const db = getDb('settings');

db.exec(`
  CREATE TABLE IF NOT EXISTS section_visibility (
    key VARCHAR(50) PRIMARY KEY,
    isVisible INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

runMigrations(db, [
  {
    id: '2026-10-30-site-settings',
    up: (db) => {
      // Only values that differ from SETTING_DEFAULTS need a row
      db.exec(`
        CREATE TABLE site_settings (
          key VARCHAR(50) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
]);

// Seed any section that has no row yet with its default
const _seed = db.prepare('INSERT OR IGNORE INTO section_visibility (key, isVisible) VALUES (?, ?)');
for (const [key, isVisible] of Object.entries({ ...SECTION_DEFAULTS, ...configSectionDefaults() })) {
  if (key in SECTION_DEFAULTS) _seed.run(key, isVisible ? 1 : 0);
}

const _getAll = db.prepare('SELECT key, isVisible FROM section_visibility');
const _setVisibility = db.prepare('UPDATE section_visibility SET isVisible = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
const _getSettings = db.prepare('SELECT key, value FROM site_settings');
const _setSetting = db.prepare(`
  INSERT INTO site_settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
`);

export function GetSectionVisibility(): SectionVisibility {
  const visibility: SectionVisibility = { ...SECTION_DEFAULTS };
  const rows = _getAll.all() as Array<{ key: string; isVisible: number }>;
  for (const row of rows) {
    if (row.key in visibility) visibility[row.key as SectionKey] = row.isVisible === 1;
  }
  return visibility;
}

export function SetSectionVisibility(key: SectionKey, isVisible: boolean) {
  return _setVisibility.run(isVisible ? 1 : 0, key).changes;
}

// Built-in defaults, then config/site.json, then whatever was saved in the admin
export function GetSiteSettings(): SiteSettings {
  const settings = { ...SETTING_DEFAULTS, ...configDefaults() };
  for (const row of _getSettings.all() as Array<{ key: string; value: string }>) {
    if (isSettingKey(row.key)) settings[row.key] = row.value;
  }
  return settings;
}

export function SaveSiteSettings(values: Partial<Record<SettingKey, string>>) {
  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) _setSetting.run(key, value);
  })();
}
