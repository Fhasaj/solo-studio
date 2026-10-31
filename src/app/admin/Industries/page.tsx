"use client";

import PageHeader from "../components/pageHeader";
import ContentManager from "../components/contentManager";

export default function IndustriesPage() {
  return (
    <>
      <PageHeader title="Industries" description="Each industry gets its own page at /industries/…, linked from the services section. Its case studies are matched by their industry." />
      <ContentManager type="industries" describe={(item) => ({ title: String(item.name), subtitle: `/industries/${item.slug} · ${String(item.intro).slice(0, 80)}` })} />
    </>
  );
}
