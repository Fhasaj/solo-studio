"use client";

import PageHeader from "../components/pageHeader";
import ContentManager from "../components/contentManager";

export default function FaqsPage() {
  return (
    <>
      <PageHeader section="faq" title="FAQs" description="Questions answered on the home page. Write them the way clients would ask: these are what search engines and AI tools quote." />
      <ContentManager type="faqs" describe={(item) => ({ title: String(item.question), subtitle: String(item.answer).slice(0, 100) })} />
    </>
  );
}
