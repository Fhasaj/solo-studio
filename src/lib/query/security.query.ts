import { getDb } from '../dbConnect';
import { runMigrations } from '../migrate';
import { encryptValue } from '../secureStore';

const db = getDb('settings');

runMigrations(db, [
  {
    id: '2026-10-31-admin-codes',
    up: (db) => {
      db.exec(`
        -- One-time codes emailed to the admin (sign-in, unlocking bank details). Only a hash is stored.
        CREATE TABLE admin_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purpose TEXT NOT NULL,
          codeHash TEXT NOT NULL,
          expiresAt TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          usedAt TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Encrypted values (bank details). Never stored in plain text.
        CREATE TABLE secure_values (
          key VARCHAR(50) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    // Bank details used to live in plain text in site_settings: encrypt them and remove the plain copies
    id: '2026-10-31-encrypt-bank-details',
    up: (db) => {
      const hasSettings = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'site_settings'").get();
      if (!hasSettings) return;
      const rows = db
        .prepare("SELECT key, value FROM site_settings WHERE key IN ('bankAccountName', 'bankSortCode', 'bankAccountNumber')")
        .all() as { key: string; value: string }[];
      const insert = db.prepare('INSERT OR REPLACE INTO secure_values (key, value) VALUES (?, ?)');
      for (const row of rows) if (row.value) insert.run(row.key, encryptValue(row.value));
      db.prepare("DELETE FROM site_settings WHERE key IN ('bankAccountName', 'bankSortCode', 'bankAccountNumber')").run();
    },
  },
]);

// ---- One-time codes ----

export function InsertAdminCode(purpose: string, codeHash: string, expiresAt: string) {
  db.transaction(() => {
    // Only the newest code for a purpose works
    db.prepare("UPDATE admin_codes SET usedAt = 'superseded' WHERE purpose = ? AND usedAt IS NULL").run(purpose);
    db.prepare('DELETE FROM admin_codes WHERE expiresAt < ?').run(new Date(Date.now() - 86_400_000).toISOString());
    db.prepare('INSERT INTO admin_codes (purpose, codeHash, expiresAt) VALUES (?, ?, ?)').run(purpose, codeHash, expiresAt);
  })();
}

export function GetLiveAdminCode(purpose: string) {
  return db
    .prepare('SELECT id, codeHash, attempts FROM admin_codes WHERE purpose = ? AND usedAt IS NULL AND expiresAt > ? ORDER BY id DESC LIMIT 1')
    .get(purpose, new Date().toISOString()) as { id: number; codeHash: string; attempts: number } | undefined;
}

export function RecordAdminCodeAttempt(id: number, used: boolean) {
  db.prepare('UPDATE admin_codes SET attempts = attempts + 1, usedAt = CASE WHEN ? THEN ? ELSE usedAt END WHERE id = ?').run(
    used ? 1 : 0,
    new Date().toISOString(),
    id
  );
}

export function ExpireAdminCode(id: number) {
  db.prepare("UPDATE admin_codes SET usedAt = 'locked' WHERE id = ?").run(id);
}

// ---- Encrypted values ----

export function GetSecureValues(keys: readonly string[]) {
  const rows = db
    .prepare(`SELECT key, value, updated_at FROM secure_values WHERE key IN (${keys.map(() => '?').join(', ')})`)
    .all(...keys) as { key: string; value: string; updated_at: string }[];
  return rows;
}

export function SaveSecureValues(values: Record<string, string>) {
  const upsert = db.prepare(`
    INSERT INTO secure_values (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) upsert.run(key, value);
  })();
}
