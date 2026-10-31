import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import {
  CASE_STUDY_STATUSES,
  DeleteCaseStudy,
  GetCaseStudy,
  IsSlugTaken,
  ListCaseStudies,
  MoveCaseStudy,
  PublishProblems,
  SaveCaseStudy,
  SetCaseStudyFeatured,
  SetCaseStudyStatus,
  type CaseStudyImage,
  type CaseStudyInput,
} from '@/lib/query/caseStudies.query';
import { isValidSlug, slugify, SLUG_MAX } from '@/lib/slug';
import { readUploadedImage } from '@/lib/uploads';
import { readBool, readEnum, readId, readText, sendApiError, ValidationError } from '@/lib/validate';
import { splitTags } from '@/lib/content';
import { pingIndexNow } from '@/lib/indexNow';

async function readImage(value: unknown, field: string): Promise<CaseStudyImage> {
  const input = (value ?? {}) as Record<string, unknown>;
  const src = readText(input.src, field, { label: 'Image', max: 100, required: true });
  const alt = readText(input.alt, field, { label: 'Alt text', max: 200 });
  if (!alt) throw new ValidationError(field, 'Every image needs alt text describing what it shows');
  // Only images uploaded through /api/admin/upload are accepted, and their real size is read from disk
  const image = await readUploadedImage(src);
  if (!image) throw new ValidationError(field, 'That image is missing. Upload it again.');
  return { ...image, alt };
}

async function readInput(body: Record<string, unknown>, id: number | null): Promise<CaseStudyInput> {
  const title = readText(body.title, 'title', { label: 'Title', max: 120, required: true });
  const slug = readText(body.slug, 'slug', { label: 'Slug', max: SLUG_MAX }) || slugify(title);
  if (!isValidSlug(slug)) throw new ValidationError('slug', 'The slug can only use lowercase letters, numbers and single hyphens');
  if (IsSlugTaken(slug, id)) throw new ValidationError('slug', 'Another case study already uses that slug');

  const tags = splitTags(readText(body.tech, 'tech', { label: 'Tech stack', max: 500 }));
  if (tags.length > 20 || tags.some((tag) => tag.length > 40)) throw new ValidationError('tech', 'Use up to 20 tags of 40 characters or fewer');

  const gallery = Array.isArray(body.gallery) ? body.gallery : [];
  if (gallery.length > 20) throw new ValidationError('gallery', 'A gallery can have up to 20 images');

  const multiline = (field: string, label: string) => readText(body[field], field, { label, max: 8000, multiline: true });

  return {
    slug,
    title,
    clientName: readText(body.clientName, 'clientName', { label: 'Client name', max: 120 }),
    industry: readText(body.industry, 'industry', { label: 'Industry', max: 80 }),
    summary: readText(body.summary, 'summary', { label: 'Summary', max: 400 }),
    problem: multiline('problem', 'The problem'),
    solution: multiline('solution', 'What I built'),
    results: multiline('results', 'Results'),
    tech: tags.join(', '),
    cover: body.cover ? await readImage(body.cover, 'cover') : null,
    gallery: await Promise.all(gallery.map((image, index) => readImage(image, `gallery.${index}`))),
    featured: readBool(body.featured ?? false, 'featured'),
    status: readEnum(body.status ?? 'draft', 'status', CASE_STUDY_STATUSES, 'Status'),
    seoTitle: readText(body.seoTitle, 'seoTitle', { label: 'SEO title', max: 70 }),
    seoDescription: readText(body.seoDescription, 'seoDescription', { label: 'Meta description', max: 170 }),
  };
}

function assertPublishable(input: Parameters<typeof PublishProblems>[0]) {
  const problems = PublishProblems(input);
  if (problems.length) throw new ValidationError('status', `Not ready to publish: ${problems.join(' ')}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};

  try {
    switch (req.method) {
      case 'GET': {
        if (req.query.id) {
          const caseStudy = GetCaseStudy(readId(req.query.id));
          return caseStudy ? res.status(200).json({ ok: true, data: caseStudy }) : res.status(404).json({ ok: false, error: 'Not found' });
        }
        return res.status(200).json({ ok: true, data: ListCaseStudies() });
      }
      case 'POST':
      case 'PUT': {
        const id = req.method === 'PUT' ? readId(body.id) : null;
        if (id !== null && !GetCaseStudy(id)) return res.status(404).json({ ok: false, error: 'Not found' });
        const input = await readInput(body, id);
        if (input.status === 'published') assertPublishable(input);
        const savedId = SaveCaseStudy(id, input);
        if (input.status === 'published') pingIndexNow([`/work/${input.slug}`, '/work', '/']);
        return res.status(200).json({ ok: true, id: savedId });
      }
      case 'PATCH': {
        const id = readId(body.id);
        const caseStudy = GetCaseStudy(id);
        if (!caseStudy) return res.status(404).json({ ok: false, error: 'Not found' });
        if (body.move === 'up' || body.move === 'down') MoveCaseStudy(id, body.move);
        if (body.featured !== undefined) SetCaseStudyFeatured(id, readBool(body.featured, 'featured'));
        if (body.status !== undefined) {
          const status = readEnum(body.status, 'status', CASE_STUDY_STATUSES, 'Status');
          if (status === 'published') assertPublishable(caseStudy);
          SetCaseStudyStatus(id, status);
          // Unpublishing is announced too, so the page drops out of results sooner
          pingIndexNow([`/work/${caseStudy.slug}`, '/work']);
        }
        return res.status(200).json({ ok: true });
      }
      case 'DELETE':
        DeleteCaseStudy(readId(body.id));
        return res.status(200).json({ ok: true });
      default:
        return res.status(405).end();
    }
  } catch (err) {
    return sendApiError(res, err);
  }
}
