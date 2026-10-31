/*
 * @name: Migrations
 * @description: Applies numbered schema/data migrations to a database, once each, tracked in schema_migrations.
 * */

import type Database from 'better-sqlite3';

export interface Migration {
  // Never rename an id once it has shipped: it is how a database remembers what has run
  id: string;
  up: (db: Database.Database) => void;
}

export function runMigrations(db: Database.Database, migrations: Migration[]) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const isApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
  const markApplied = db.prepare('INSERT INTO schema_migrations (id) VALUES (?)');

  for (const migration of migrations) {
    // IMMEDIATE takes the write lock first, so two processes starting together (e.g. build workers)
    // can't both run the same migration
    db.transaction(() => {
      if (isApplied.get(migration.id)) return;
      migration.up(db);
      markApplied.run(migration.id);
    }).immediate();
  }
}
