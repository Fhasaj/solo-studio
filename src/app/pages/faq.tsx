import type { ContentRow } from "@/lib/content";
import { faqSchema, JsonLd } from "@/lib/seo";
import RichText from "@/lib/richText";

// Questions people ask before hiring a developer. Answers are in the page HTML (not loaded later), so search engines
// and AI answers can read them, and marked up as an FAQPage.
export default function Faq({ items }: { items: ContentRow[] }) {
  if (items.length === 0) return null;

  return (
    <section id="faq" className="w-full bg-backgroundColour scroll-mt-20" aria-labelledby="faq-heading">
      <JsonLd data={faqSchema(items)} />
      <div className="section-container">
        <p className="eyebrow">FAQ</p>
        <h2 id="faq-heading" className="section-title">Common questions</h2>
        <div className="mt-10 grid grid-cols-1 gap-3 max-w-4xl">
          {items.map((faq) => (
            <details key={faq.id} className="card group p-0 open:border-accentColour/50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-FiraSans-SemiBold text-textColour [&::-webkit-details-marker]:hidden">
                <h3 className="text-lg">{faq.question}</h3>
                <span className="text-2xl text-accentColour transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <RichText text={String(faq.answer)} className="px-5 pb-5 space-y-3 text-mutedColour leading-relaxed" headingLevel={4} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
