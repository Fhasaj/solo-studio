"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MdArrowDownward, MdArrowUpward } from "react-icons/md";
import type { CaseStudy } from "@/lib/query/caseStudies.query";
import PageHeader from "../components/pageHeader";
import { api, showError, showSuccess } from "../components/api";
import { dangerButton, Pill, smallButton } from "../components/fields";

export default function CaseStudiesPage() {
  const [items, setItems] = useState<CaseStudy[] | null>(null);

  const load = useCallback(() => api<CaseStudy[]>("/api/admin/case-studies").then(setItems).catch(showError), []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: object, message?: string) => {
    try {
      await api("/api/admin/case-studies", "PATCH", body);
      if (message) showSuccess(message);
      await load();
    } catch (error) {
      showError(error);
    }
  };

  const remove = async (item: CaseStudy) => {
    if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    try {
      await api("/api/admin/case-studies", "DELETE", { id: item.id });
      showSuccess("Deleted");
      await load();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <>
      <PageHeader section="work" title="Case studies" description="Published case studies get their own page at /work/<slug>. Featured ones also show on the home page, in this order." />
      <div className="mb-6">
        <Link href="/admin/CaseStudies/new" className="btn-primary">New case study</Link>
      </div>

      <ul className="flex flex-col gap-3">
        {items === null && <li className="text-mutedColour">Loading…</li>}
        {items?.length === 0 && <li className="card p-6 text-mutedColour">No case studies yet.</li>}
        {items?.map((item, index) => (
          <li key={item.id} className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/CaseStudies/${item.id}`} className="font-FiraSans-Bold text-textColour hover:text-accentColour">{item.title}</Link>
                <p className="text-sm text-mutedColour">/work/{item.slug}{item.industry ? ` · ${item.industry}` : ""}</p>
              </div>
              <div className="flex gap-2">
                {item.featured && <Pill tone="blue">Featured</Pill>}
                <Pill tone={item.status === "published" ? "green" : "grey"}>{item.status === "published" ? "Published" : "Draft"}</Pill>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link href={`/admin/CaseStudies/${item.id}`} className={smallButton}>Edit</Link>
              <a href={`/admin/preview/work/${item.id}`} target="_blank" rel="noreferrer" className={smallButton}>Preview</a>
              {item.status === "published" && (
                <a href={`/work/${item.slug}`} target="_blank" rel="noreferrer" className={smallButton}>View live</a>
              )}
              <button type="button" className={smallButton} onClick={() => patch({ id: item.id, featured: !item.featured }, item.featured ? "No longer featured" : "Featured")}>
                {item.featured ? "Unfeature" : "Feature"}
              </button>
              <button type="button" className={smallButton} onClick={() => patch({ id: item.id, status: item.status === "published" ? "draft" : "published" }, item.status === "published" ? "Moved back to drafts" : "Published")}>
                {item.status === "published" ? "Unpublish" : "Publish"}
              </button>
              <button type="button" aria-label="Move up" disabled={index === 0} className={`${smallButton} p-1.5!`} onClick={() => patch({ id: item.id, move: "up" })}>
                <MdArrowUpward />
              </button>
              <button type="button" aria-label="Move down" disabled={index === items.length - 1} className={`${smallButton} p-1.5!`} onClick={() => patch({ id: item.id, move: "down" })}>
                <MdArrowDownward />
              </button>
              <button type="button" className={`${dangerButton} ml-auto`} onClick={() => remove(item)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
