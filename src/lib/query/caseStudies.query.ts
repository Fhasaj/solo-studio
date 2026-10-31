import { getDb } from '../dbConnect';
import { splitTags } from '../content';
import { sqliteToIso } from '../format';
// The case study tables are created by the content migrations
import './content.query';

const db = getDb('content');

export const CASE_STUDY_STATUSES = ['draft', 'published'] as const;
export type CaseStudyStatus = (typeof CASE_STUDY_STATUSES)[number];

export interface CaseStudyImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface CaseStudyInput {
  slug: string;
  title: string;
  clientName: string;
  industry: string;
  summary: string;
  problem: string;
  solution: string;
  results: string;
  tech: string;
  cover: CaseStudyImage | null;
  gallery: CaseStudyImage[];
  featured: boolean;
  status: CaseStudyStatus;
  seoTitle: string;
  seoDescription: string;
}

export interface CaseStudy extends Omit<CaseStudyInput, 'tech'> {
  id: number;
  tech: string[];
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CaseStudyRow {
  id: number;
  slug: string;
  title: string;
  clientName: string;
  industry: string;
  summary: string;
  problem: string;
  solution: string;
  results: string;
  tech: string;
  coverSrc: string;
  coverAlt: string;
  coverWidth: number;
  coverHeight: number;
  featured: number;
  sortOrder: number;
  status: CaseStudyStatus;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const _images = db.prepare('SELECT src, alt, width, height FROM case_study_images WHERE caseStudyId = ? ORDER BY sortOrder, id');

function toCaseStudy(row: CaseStudyRow, withGallery: boolean): CaseStudy {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    clientName: row.clientName,
    industry: row.industry,
    summary: row.summary,
    problem: row.problem,
    solution: row.solution,
    results: row.results,
    tech: splitTags(row.tech),
    cover: row.coverSrc ? { src: row.coverSrc, alt: row.coverAlt, width: row.coverWidth, height: row.coverHeight } : null,
    gallery: withGallery ? (_images.all(row.id) as CaseStudyImage[]) : [],
    featured: row.featured === 1,
    sortOrder: row.sortOrder,
    status: row.status,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: sqliteToIso(row.publishedAt),
    createdAt: sqliteToIso(row.createdAt),
    updatedAt: sqliteToIso(row.updatedAt),
  };
}

export function ListCaseStudies({ publishedOnly = false, featuredOnly = false } = {}) {
  const where = [publishedOnly && "status = 'published'", featuredOnly && 'featured = 1'].filter(Boolean);
  const rows = db
    .prepare(`SELECT * FROM case_studies ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY sortOrder, id`)
    .all() as CaseStudyRow[];
  return rows.map((row) => toCaseStudy(row, false));
}

export function GetCaseStudy(id: number) {
  const row = db.prepare('SELECT * FROM case_studies WHERE id = ?').get(id) as CaseStudyRow | undefined;
  return row ? toCaseStudy(row, true) : null;
}

export function GetPublishedCaseStudyBySlug(slug: string) {
  const row = db.prepare("SELECT * FROM case_studies WHERE slug = ? AND status = 'published'").get(slug) as CaseStudyRow | undefined;
  return row ? toCaseStudy(row, true) : null;
}

// The current slug for an old one, if that case study is still published
export function FindCaseStudyRedirect(oldSlug: string) {
  const row = db
    .prepare(
      `SELECT c.slug FROM case_study_redirects r JOIN case_studies c ON c.id = r.caseStudyId
       WHERE r.oldSlug = ? AND c.status = 'published'`
    )
    .get(oldSlug) as { slug: string } | undefined;
  return row?.slug ?? null;
}

export function IsSlugTaken(slug: string, exceptId: number | null) {
  return Boolean(db.prepare('SELECT 1 FROM case_studies WHERE slug = ? AND id IS NOT ?').get(slug, exceptId));
}

// Placeholder text left in the seeded drafts, e.g. "[How much time does it save?]"
const PLACEHOLDER = /\[[^\]]{3,}\]/;

// Reasons a case study can't be published yet (empty when it's ready)
export function PublishProblems(input: Pick<CaseStudyInput, 'title' | 'summary' | 'problem' | 'solution' | 'results'>) {
  const problems: string[] = [];
  if (!input.summary) problems.push('Add a summary.');
  if (!input.solution) problems.push('Describe what you built.');
  const withPlaceholders = (['title', 'summary', 'problem', 'solution', 'results'] as const).filter((field) => PLACEHOLDER.test(input[field]));
  if (withPlaceholders.length) problems.push(`Replace the [placeholder] text in: ${withPlaceholders.join(', ')}.`);
  return problems;
}

export function SaveCaseStudy(id: number | null, input: CaseStudyInput) {
  const values = {
    slug: input.slug,
    title: input.title,
    clientName: input.clientName,
    industry: input.industry,
    summary: input.summary,
    problem: input.problem,
    solution: input.solution,
    results: input.results,
    tech: input.tech,
    coverSrc: input.cover?.src ?? '',
    coverAlt: input.cover?.alt ?? '',
    coverWidth: input.cover?.width ?? 0,
    coverHeight: input.cover?.height ?? 0,
    featured: input.featured ? 1 : 0,
    status: input.status,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  };

  return db.transaction(() => {
    let caseStudyId: number;
    if (id === null) {
      const { next } = db.prepare('SELECT COALESCE(MAX(sortOrder), -1) + 1 AS next FROM case_studies').get() as { next: number };
      const info = db
        .prepare(
          `INSERT INTO case_studies (slug, title, clientName, industry, summary, problem, solution, results, tech, coverSrc, coverAlt,
             coverWidth, coverHeight, featured, status, seoTitle, seoDescription, sortOrder, publishedAt)
           VALUES (@slug, @title, @clientName, @industry, @summary, @problem, @solution, @results, @tech, @coverSrc, @coverAlt,
             @coverWidth, @coverHeight, @featured, @status, @seoTitle, @seoDescription, @sortOrder,
             CASE WHEN @status = 'published' THEN CURRENT_TIMESTAMP END)`
        )
        .run({ ...values, sortOrder: next });
      caseStudyId = Number(info.lastInsertRowid);
    } else {
      const current = db.prepare('SELECT slug FROM case_studies WHERE id = ?').get(id) as { slug: string } | undefined;
      if (!current) return null;
      db.prepare(
        `UPDATE case_studies SET slug = @slug, title = @title, clientName = @clientName, industry = @industry, summary = @summary,
           problem = @problem, solution = @solution, results = @results, tech = @tech, coverSrc = @coverSrc, coverAlt = @coverAlt,
           coverWidth = @coverWidth, coverHeight = @coverHeight, featured = @featured, status = @status, seoTitle = @seoTitle,
           seoDescription = @seoDescription, updatedAt = CURRENT_TIMESTAMP,
           publishedAt = CASE WHEN @status = 'published' THEN COALESCE(publishedAt, CURRENT_TIMESTAMP) ELSE publishedAt END
         WHERE id = @id`
      ).run({ ...values, id });
      if (current.slug !== input.slug) {
        db.prepare('INSERT OR REPLACE INTO case_study_redirects (oldSlug, caseStudyId) VALUES (?, ?)').run(current.slug, id);
      }
      caseStudyId = id;
    }

    // A slug in use again is no longer an old one
    db.prepare('DELETE FROM case_study_redirects WHERE oldSlug = ?').run(input.slug);

    db.prepare('DELETE FROM case_study_images WHERE caseStudyId = ?').run(caseStudyId);
    const insertImage = db.prepare(
      'INSERT INTO case_study_images (caseStudyId, src, alt, width, height, sortOrder) VALUES (?, ?, ?, ?, ?, ?)'
    );
    input.gallery.forEach((image, index) => insertImage.run(caseStudyId, image.src, image.alt, image.width, image.height, index));
    return caseStudyId;
  })();
}

export function SetCaseStudyFeatured(id: number, featured: boolean) {
  return db.prepare('UPDATE case_studies SET featured = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(featured ? 1 : 0, id).changes;
}

export function SetCaseStudyStatus(id: number, status: CaseStudyStatus) {
  return db
    .prepare(
      `UPDATE case_studies SET status = @status, updatedAt = CURRENT_TIMESTAMP,
         publishedAt = CASE WHEN @status = 'published' THEN COALESCE(publishedAt, CURRENT_TIMESTAMP) ELSE publishedAt END
       WHERE id = @id`
    )
    .run({ id, status }).changes;
}

export function DeleteCaseStudy(id: number) {
  return db.prepare('DELETE FROM case_studies WHERE id = ?').run(id).changes;
}

// Swaps a case study with its neighbour above or below
export function MoveCaseStudy(id: number, direction: 'up' | 'down') {
  const rows = db.prepare('SELECT id FROM case_studies ORDER BY sortOrder, id').all() as { id: number }[];
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= rows.length) return 0;

  [rows[index], rows[target]] = [rows[target], rows[index]];
  const update = db.prepare('UPDATE case_studies SET sortOrder = ? WHERE id = ?');
  db.transaction(() => rows.forEach((row, order) => update.run(order, row.id)))();
  return 1;
}
