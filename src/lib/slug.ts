/*
 * @name: Slugs
 * @description: Builds and checks the readable URL part of case study pages (/work/<slug>).
 * */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;

export function slugify(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

export function isValidSlug(slug: string) {
  return slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug);
}
