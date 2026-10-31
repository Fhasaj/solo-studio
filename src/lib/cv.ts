/*
 * @name: CV
 * @description: Whether the CV is switched on, and its parts, for the /cv page and /cv.pdf.
 * */

import { GetSectionVisibility, GetSiteSettings } from './query/settings.query';
import { inlineText, parseMarkdown } from './markdown';

export function getCv() {
  const settings = GetSiteSettings();
  if (!GetSectionVisibility().cv || !settings.cvMarkdown.trim()) return null;
  const blocks = parseMarkdown(settings.cvMarkdown);
  const heading = blocks.find((block) => block.kind === 'heading' && block.level === 1);
  const name = heading && heading.kind === 'heading' ? inlineText(heading.content) : settings.ownerName;
  // "Jane Smith CV.pdf", keeping only characters that are safe in a file name
  const fileName = `${name.replace(/[^\w .-]+/g, '').trim() || 'CV'} CV.pdf`;
  return { settings, blocks, name, fileName };
}
