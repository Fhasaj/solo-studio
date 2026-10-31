"use client";

import PageHeader from "../components/pageHeader";
import ContentManager from "../components/contentManager";

export default function ServicesPage() {
  return (
    <>
      <PageHeader section="services" title="Services" description="The service cards on the home page, in this order." />
      <ContentManager type="services" describe={item => ({ title: String(item.title), subtitle: [item.priceFrom, String(item.description).slice(0, 90)].filter(Boolean).join(" · ") })} />
    </>
  );
}
