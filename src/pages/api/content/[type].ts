import type { NextApiRequest, NextApiResponse } from 'next';
import {
  cleanFields,
  DeleteContent,
  GetContent,
  InsertContent,
  IsContentSlugTaken,
  MoveContent,
  SetContentHidden,
  UpdateContent,
} from '@/lib/query/content.query';
import { GetCaseStudy } from '@/lib/query/caseStudies.query';
import { CONTENT_TYPES, isContentType, type ContentType, type FieldConfig } from '@/lib/content';
import { requireAdmin } from '@/lib/requireAdmin';
import { SESSION_COOKIE } from '@/lib/auth';
import { isValidAdminToken } from '@/lib/adminSession';
import { readId, sendApiError, ValidationError } from '@/lib/validate';
import { isValidSlug, slugify } from '@/lib/slug';
import { pingIndexNow } from '@/lib/indexNow';

// Pages that change when this content does, for instant re-indexing
function contentUrls(type: ContentType, values: Record<string, string>) {
  if (type === 'services') return ['/', `/services/${values.slug}`];
  if (type === 'industries') return [`/industries/${values.slug}`];
  return ['/'];
}

// Page addresses: made from the title or name when empty, and unique within the type
function checkSlug(type: ContentType, values: Record<string, string>, id: number | null) {
  const fields: readonly FieldConfig[] = CONTENT_TYPES[type].fields;
  if (!fields.some((f) => f.type === 'slug')) return values;
  const slug = values.slug || slugify(values.title || values.name || '');
  if (!isValidSlug(slug)) throw new ValidationError('slug', 'The page address can only use lowercase letters, numbers and single hyphens');
  if (IsContentSlugTaken(type, slug, id)) throw new ValidationError('slug', 'Another item already uses that page address');
  return { ...values, slug };
}

// Fields that point at a case study must point at one that exists
function checkLinks(type: ContentType, values: Record<string, string>) {
  const fields: readonly FieldConfig[] = CONTENT_TYPES[type].fields;
  for (const field of fields.filter((f) => f.type === 'caseStudy')) {
    const value = values[field.name];
    if (value && (!/^\d+$/.test(value) || !GetCaseStudy(Number(value)))) {
      throw new ValidationError(field.name, `${field.label}: that case study doesn't exist`);
    }
  }
  return values;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type } = req.query;
  if (!isContentType(type)) return res.status(404).json({ ok: false, error: 'Unknown content type' });

  // Visitors only see visible items; the admin also sees hidden ones
  if (req.method === 'GET') {
    const isAdmin = await isValidAdminToken(req.cookies[SESSION_COOKIE]);
    return res.status(200).json({ ok: true, data: GetContent(type, isAdmin) });
  }

  if (!(await requireAdmin(req, res))) return;

  const body = req.body ?? {};

  try {
    switch (req.method) {
      case 'POST': {
        const values = checkSlug(type, checkLinks(type, cleanFields(type, body)), null);
        const id = InsertContent(type, values);
        pingIndexNow(contentUrls(type, values));
        return res.status(200).json({ ok: true, id });
      }
      case 'PUT': {
        const id = readId(body.id);
        const values = checkSlug(type, checkLinks(type, cleanFields(type, body)), id);
        UpdateContent(type, id, values);
        pingIndexNow(contentUrls(type, values));
        return res.status(200).json({ ok: true });
      }
      case 'PATCH': {
        const id = readId(body.id);
        if (typeof body.isHidden === 'boolean') SetContentHidden(type, id, body.isHidden);
        if (body.move === 'up' || body.move === 'down') MoveContent(type, id, body.move);
        return res.status(200).json({ ok: true });
      }
      case 'DELETE': {
        DeleteContent(type, readId(body.id));
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(405).end();
    }
  } catch (err) {
    return sendApiError(res, err);
  }
}
