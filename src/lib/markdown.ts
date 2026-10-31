/*
 * @name: Markdown (CV subset)
 * @description: Parses the Markdown a CV needs: headings, paragraphs, bullet and numbered lists, rules,
 * **bold**, *italic*, `code` and [links](https://…). Produces plain data that both the web page and the PDF render,
 * so they always match. Raw HTML is never passed through.
 * */

export type Inline =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean; code?: boolean }
  | { kind: 'link'; text: string; href: string; bold?: boolean; italic?: boolean };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'rule' };

// Only web and email links: no javascript: or data: URLs
export function safeHref(href: string) {
  return /^(https?:\/\/|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  // Order matters: links, code, bold, italic
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) out.push({ kind: 'text', text: text.slice(last, match.index) });
    const [, linkText, href, code, bold1, bold2, italic1, italic2] = match;
    if (linkText !== undefined) {
      const safe = safeHref(href);
      out.push(safe ? { kind: 'link', text: linkText, href: safe } : { kind: 'text', text: linkText });
    } else if (code !== undefined) out.push({ kind: 'text', text: code, code: true });
    else if ((bold1 ?? bold2) !== undefined) out.push(...parseInline(bold1 ?? bold2).map((part) => ({ ...part, bold: true })));
    else out.push(...parseInline(italic1 ?? italic2).map((part) => ({ ...part, italic: true })));
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) });
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    paragraph = [];
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line.trim());
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (!line.trim()) flush();
    else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3 | 4, content: parseInline(heading[2].replace(/\s+#+\s*$/, '')) });
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (list && /^\s{2,}\S/.test(raw)) {
      // An indented line continues the previous list item
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      if (list) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export function inlineText(content: Inline[]) {
  return content.map((part) => part.text).join('');
}
