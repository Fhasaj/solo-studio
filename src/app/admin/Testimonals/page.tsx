"use client";

import PageHeader from "../components/pageHeader";
import ContentManager from "../components/contentManager";

export default function TestimonalsPage() {
  return (
    <>
      <PageHeader section="testimonials" title="Testimonials" description="Client quotes. Visible ones show on the home page, and on their case study if linked. Only publish real quotes you have permission to use." />
      <ContentManager type="testimonials" describe={item => ({ title: String(item.name), subtitle: [item.role, String(item.quote).slice(0, 90)].filter(Boolean).join(" · ") })} />
    </>
  );
}
