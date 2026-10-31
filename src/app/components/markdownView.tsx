import type { Block, Inline } from "@/lib/markdown";

function Inlines({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((part, index) => {
        // Line breaks inside a paragraph become <br />
        const text = part.text.split("\n").flatMap((piece, i) => (i ? [<br key={i} />, piece] : [piece]));
        let node: React.ReactNode = part.kind === "text" && part.code ? <code className="font-mono text-[0.95em]">{part.text}</code> : text;
        if (part.italic) node = <em>{node}</em>;
        if (part.bold) node = <strong className="font-FiraSans-Bold text-textColour">{node}</strong>;
        if (part.kind === "link") {
          node = (
            <a href={part.href} className="text-accentColour underline underline-offset-2" rel="noreferrer" target={part.href.startsWith("mailto:") ? undefined : "_blank"}>
              {node}
            </a>
          );
        }
        return <span key={index}>{node}</span>;
      })}
    </>
  );
}

// Renders parsed Markdown as React elements (never as raw HTML)
export default function MarkdownView({ blocks, className = "" }: { blocks: Block[]; className?: string }) {
  return (
    <div className={`cv-markdown ${className}`}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading": {
            const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4";
            const style = {
              1: "text-4xl md:text-5xl font-FiraSans-ExtraBold text-textColour",
              2: "mt-10 pb-2 border-b border-borderColour text-2xl font-FiraSans-ExtraBold text-textColour",
              3: "mt-6 text-lg font-FiraSans-Bold text-textColour",
              4: "mt-4 font-FiraSans-SemiBold text-textColour",
            }[block.level];
            return <Tag key={index} className={style}><Inlines content={block.content} /></Tag>;
          }
          case "paragraph":
            return <p key={index} className="mt-3 text-mutedColour leading-relaxed"><Inlines content={block.content} /></p>;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={index} className={`mt-3 space-y-1.5 pl-5 text-mutedColour marker:text-accentColour ${block.ordered ? "list-decimal" : "list-disc"}`}>
                {block.items.map((item, i) => <li key={i}><Inlines content={item} /></li>)}
              </List>
            );
          }
          case "rule":
            return <hr key={index} className="my-8 border-borderColour" />;
        }
      })}
    </div>
  );
}
