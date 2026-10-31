/*
 * @name: Database Connect File
 * @descriptin: File used to connect to each db.
 * @API Endpoints: NONE
 * */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

//Get the list of the different Database. Add more if needed. 
type DBName = 'testimonial' | 'settings' | 'content' | 'bookings' | 'clients';

declare global {

  var __dbmap__: Map<string, Database.Database> | undefined;
}

// DB_DIR lets tests and local experiments use a scratch copy instead of the committed databases.
// The turbopackIgnore comments stop the build tracing (and bundling) everything these runtime paths could point at.
export const DB_DIR = process.env.DB_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'db');
if (!fs.existsSync(/*turbopackIgnore: true*/ DB_DIR)) fs.mkdirSync(/*turbopackIgnore: true*/ DB_DIR, { recursive: true });

function openDb(dbName: string) {
  const file = path.join(/*turbopackIgnore: true*/ DB_DIR, `${dbName}.sqlite`);
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

// Reuse across hot reloads in dev
const dbmap = global.__dbmap__ ?? new Map<string, Database.Database>();
if (process.env.NODE_ENV !== 'production') global.__dbmap__ = dbmap;

export function getDb(name: DBName) {
  let db = dbmap.get(name);
  if (!db) {
    db = openDb(name);
    dbmap.set(name, db);
  }
  return db;
}
