/*
 * @name: Rich text
 * @description: Turns plain text into paragraphs, "## " headings and "- " bullet lists as React elements.
 * Content is never rendered as HTML, so nothing typed into the admin or portal can inject markup.
 * */

import type { ReactNode } from "react";

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "h"; text: string };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h", text: line.slice(3).trim() });
    } else if (/^[-*•]\s+/.test(line)) {
      if (current?.kind !== "ul") {
        flush();
        current = { kind: "ul", items: [] };
      }
      current.items.push(line.replace(/^[-*•]\s+/, ""));
    } else {
      if (current?.kind !== "p") {
        flush();
        current = { kind: "p", lines: [] };
      }
      current.lines.push(line);
    }
  }
  flush();
  return blocks;
}

interface RichTextProps {
  text: string;
  className?: string;
  // The heading level used for "## " lines, so pages keep a logical heading order
  headingLevel?: 2 | 3 | 4;
}

export default function RichText({ text, className = "space-y-4", headingLevel = 3 }: RichTextProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <div className={className}>
      {parse(text).map((block, index): ReactNode => {
        if (block.kind === "h") {
          return (
            <Heading key={index} className="pt-2 text-xl font-FiraSans-Bold text-textColour">
              {block.text}
            </Heading>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={index} className="list-disc pl-5 space-y-2 marker:text-accentColour">
              {block.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
