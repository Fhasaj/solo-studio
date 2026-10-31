/*
 * @name: CV PDF
 * @description: Turns the CV Markdown into an A4 PDF with the site's fonts, print-friendly colours and clickable links.
 * The result is cached until the Markdown changes.
 * */

import { createHash } from 'crypto';
import path from 'path';
import PDFDocument from 'pdfkit';
import { parseMarkdown, type Inline } from './markdown';

const FONT_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts');
const FONTS = {
  regular: 'FiraSans-Regular.ttf',
  bold: 'FiraSans-Bold.ttf',
  italic: 'FiraSans-Italic.ttf',
  boldItalic: 'FiraSans-BoldItalic.ttf',
  heading: 'FiraSans-ExtraBold.ttf',
};
const COLOURS = { text: '#111827', muted: '#374151', accent: '#0b5c8e', rule: '#cbd5e1' };

let cache: { key: string; pdf: Buffer } | null = null;

function fontFor(part: Inline) {
  if (part.bold && part.italic) return 'boldItalic';
  if (part.bold) return 'bold';
  if (part.italic) return 'italic';
  return 'regular';
}

export async function renderCvPdf(markdown: string, meta: { title: string; author: string }) {
  const key = createHash('sha256').update(`${meta.title}\n${meta.author}\n${markdown}`).digest('hex');
  if (cache?.key === key) return cache.pdf;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 54, right: 54 },
    // Starting with a bundled font means pdfkit never needs its built-in Helvetica files
    font: path.join(/*turbopackIgnore: true*/ FONT_DIR, FONTS.regular),
    info: { Title: meta.title, Author: meta.author, Creator: 'Solo Studio' },
    bufferPages: true,
  });
  for (const [name, file] of Object.entries(FONTS)) doc.registerFont(name, path.join(/*turbopackIgnore: true*/ FONT_DIR, file));

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  // Writes a run of inline parts as one flowing paragraph
  const write = (content: Inline[], { size, colour, x = left, w = width, font }: { size: number; colour: string; x?: number; w?: number; font?: string }) => {
    const parts = content.filter((part) => part.text);
    if (!parts.length) return;
    doc.fontSize(size);
    parts.forEach((part, index) => {
      const isLink = part.kind === 'link';
      doc.font(font ?? fontFor(part)).fillColor(isLink ? COLOURS.accent : colour);
      const options = { continued: index < parts.length - 1, link: isLink ? part.href : undefined, underline: isLink, lineGap: 2 };
      if (index === 0) doc.text(part.text, x, doc.y, { ...options, width: w });
      else doc.text(part.text, options);
    });
  };

  const blocks = parseMarkdown(markdown);
  blocks.forEach((block, index) => {
    const previous = blocks[index - 1];
    switch (block.kind) {
      case 'heading':
        if (block.level === 1) {
          write(block.content, { size: 24, colour: COLOURS.text, font: 'heading' });
          doc.moveDown(0.2);
        } else if (block.level === 2) {
          doc.moveDown(previous ? 0.9 : 0);
          write(block.content.map((part) => ({ ...part, text: part.text.toUpperCase() })), { size: 11, colour: COLOURS.accent, font: 'bold' });
          doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).lineWidth(0.75).strokeColor(COLOURS.rule).stroke();
          doc.moveDown(0.5);
        } else {
          doc.moveDown(previous?.kind === 'heading' ? 0.2 : 0.6);
          write(block.content, { size: block.level === 3 ? 11 : 10, colour: COLOURS.text, font: 'bold' });
          doc.moveDown(0.15);
        }
        break;
      case 'paragraph':
        write(block.content, { size: 10, colour: COLOURS.muted });
        doc.moveDown(0.4);
        break;
      case 'list':
        block.items.forEach((item, i) => {
          const marker = block.ordered ? `${i + 1}.` : '•';
          const y = doc.y;
          doc.font('regular').fontSize(10).fillColor(COLOURS.accent).text(marker, left, y, { width: 14 });
          doc.y = y;
          write(item, { size: 10, colour: COLOURS.muted, x: left + 14, w: width - 14 });
          doc.moveDown(0.15);
        });
        doc.moveDown(0.3);
        break;
      case 'rule':
        doc.moveDown(0.3);
        doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.5).strokeColor(COLOURS.rule).stroke();
        doc.moveDown(0.6);
        break;
    }
  });

  // Page numbers on multi-page CVs
  const range = doc.bufferedPageRange();
  if (range.count > 1) {
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Writing inside the bottom margin would otherwise start a new page
      doc.page.margins.bottom = 0;
      doc.font('regular').fontSize(8).fillColor(COLOURS.muted).text(`${meta.author} · ${i + 1} of ${range.count}`, left, doc.page.height - 32, { width, align: 'right', lineBreak: false });
    }
  }

  doc.end();
  const pdf = await done;
  cache = { key, pdf };
  return pdf;
}
