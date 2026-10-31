import { getDb } from '../dbConnect';
import { runMigrations } from '../migrate';
import { CONTENT_TYPES, type ContentRow, type ContentType, type FieldConfig } from '../content';
import { readText } from '../validate';
import { contentMigrations } from '../migrations/content';

const db = getDb('content');

function fieldNames(type: ContentType) {
  return CONTENT_TYPES[type].fields.map((field) => field.name);
}

// Create every table and add columns for new fields. Data changes live in migrations/content.ts
for (const type of Object.keys(CONTENT_TYPES) as ContentType[]) {
  const columns = fieldNames(type).map((name) => `${name} TEXT NOT NULL DEFAULT ''`).join(',\n    ');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${type} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${columns},
      sortOrder INTEGER NOT NULL DEFAULT 0,
      isHidden INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add columns for any fields added since the table was created
  const existing = new Set((db.prepare(`PRAGMA table_info(${type})`).all() as { name: string }[]).map((column) => column.name));
  for (const name of fieldNames(type).filter((name) => !existing.has(name))) {
    db.exec(`ALTER TABLE ${type} ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
  }
}

runMigrations(db, contentMigrations);

function insertRow(type: ContentType, values: Record<string, string>, sortOrder: number) {
  const names = fieldNames(type);
  const placeholders = names.map(() => '?').join(', ');
  const info = db
    .prepare(`INSERT INTO ${type} (${names.join(', ')}, sortOrder) VALUES (${placeholders}, ?)`)
    .run(...names.map((name) => values[name] ?? ''), sortOrder);
  return Number(info.lastInsertRowid);
}

// Keeps only known fields, as cleaned strings. Throws a ValidationError for missing or over-long values.
export function cleanFields(type: ContentType, input: Record<string, unknown>) {
  const values: Record<string, string> = {};
  const fields: readonly FieldConfig[] = CONTENT_TYPES[type].fields;
  for (const field of fields) {
    const multiline = field.type === 'textarea' || field.type === 'lines';
    values[field.name] = readText(input[field.name], field.name, {
      label: field.label,
      max: field.maxLength ?? 200,
      required: field.required,
      multiline,
    });
  }
  return values;
}

export function GetContent(type: ContentType, includeHidden = false): ContentRow[] {
  const where = includeHidden ? '' : 'WHERE isHidden = 0';
  const rows = db.prepare(`SELECT * FROM ${type} ${where} ORDER BY sortOrder, id`).all() as Array<
    Record<string, string | number>
  >;
  return rows.map((row) => ({ ...row, isHidden: row.isHidden === 1 }) as ContentRow);
}

// A visible item by its page address (services and industries)
export function GetContentBySlug(type: ContentType, slug: string) {
  const row = db.prepare(`SELECT * FROM ${type} WHERE slug = ? AND isHidden = 0`).get(slug) as Record<string, string | number> | undefined;
  return row ? ({ ...row, isHidden: false } as ContentRow) : null;
}

export function IsContentSlugTaken(type: ContentType, slug: string, exceptId: number | null) {
  return Boolean(db.prepare(`SELECT 1 FROM ${type} WHERE slug = ? AND id IS NOT ?`).get(slug, exceptId));
}

export function InsertContent(type: ContentType, values: Record<string, string>) {
  const { next } = db.prepare(`SELECT COALESCE(MAX(sortOrder), -1) + 1 AS next FROM ${type}`).get() as { next: number };
  return insertRow(type, values, next);
}

export function UpdateContent(type: ContentType, id: number, values: Record<string, string>) {
  const names = fieldNames(type);
  return db
    .prepare(`UPDATE ${type} SET ${names.map((name) => `${name} = ?`).join(', ')} WHERE id = ?`)
    .run(...names.map((name) => values[name]), id).changes;
}

export function DeleteContent(type: ContentType, id: number) {
  return db.prepare(`DELETE FROM ${type} WHERE id = ?`).run(id).changes;
}

export function SetContentHidden(type: ContentType, id: number, isHidden: boolean) {
  return db.prepare(`UPDATE ${type} SET isHidden = ? WHERE id = ?`).run(isHidden ? 1 : 0, id).changes;
}

// Swaps an item with its neighbour above or below
export function MoveContent(type: ContentType, id: number, direction: 'up' | 'down') {
  const rows = db.prepare(`SELECT id FROM ${type} ORDER BY sortOrder, id`).all() as { id: number }[];
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= rows.length) return 0;

  [rows[index], rows[target]] = [rows[target], rows[index]];
  const update = db.prepare(`UPDATE ${type} SET sortOrder = ? WHERE id = ?`);
  db.transaction(() => rows.forEach((row, order) => update.run(order, row.id)))();
  return 1;
}
