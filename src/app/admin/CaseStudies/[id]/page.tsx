"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MdArrowDownward, MdArrowUpward } from "react-icons/md";
import type { CaseStudy, CaseStudyStatus } from "@/lib/query/caseStudies.query";
import { slugify } from "@/lib/slug";
import { splitTags } from "@/lib/content";
import PageHeader from "../../components/pageHeader";
import ImageField, { type ImageValue } from "../../components/imageField";
import { api, ApiError, showError, showSuccess } from "../../components/api";
import { Checkbox, Pill, smallButton, TextArea, TextField } from "../../components/fields";

interface Form {
  title: string;
  slug: string;
  clientName: string;
  industry: string;
  summary: string;
  problem: string;
  solution: string;
  results: string;
  tech: string;
  cover: ImageValue | null;
  gallery: ImageValue[];
  featured: boolean;
  status: CaseStudyStatus;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY: Form = {
  title: "",
  slug: "",
  clientName: "",
  industry: "",
  summary: "",
  problem: "",
  solution: "",
  results: "",
  tech: "",
  cover: null,
  gallery: [],
  featured: true,
  status: "draft",
  seoTitle: "",
  seoDescription: "",
};

const TEXT_HELP = "Leave a blank line between paragraphs. Start a line with \"- \" for a bullet point.";

function toForm(caseStudy: CaseStudy): Form {
  return { ...caseStudy, tech: caseStudy.tech.join(", ") };
}

export default function CaseStudyEditor() {
  const id = useParams<{ id: string }>()?.id ?? "new";
  const router = useRouter();
  const isNew = id === "new";
  const [form, setForm] = useState<Form>(EMPTY);
  const [savedStatus, setSavedStatus] = useState<CaseStudyStatus>("draft");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // The slug follows the title until it's edited by hand (or the case study is saved)
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    api<CaseStudy>(`/api/admin/case-studies?id=${encodeURIComponent(id)}`)
      .then((caseStudy) => {
        setForm(toForm(caseStudy));
        setSavedStatus(caseStudy.status);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [isNew, id]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const setTitle = (title: string) => setForm((prev) => ({ ...prev, title, slug: slugTouched ? prev.slug : slugify(title) }));

  const save = async (status: CaseStudyStatus, { preview = false } = {}) => {
    // Opened before the request so pop-up blockers allow it
    const previewWindow = preview ? window.open("about:blank", "_blank") : null;
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, status, ...(isNew ? {} : { id: Number(id) }) };
      const { id: savedId } = await api<{ id: number }>("/api/admin/case-studies", isNew ? "POST" : "PUT", body);
      setSavedStatus(status);
      setForm((prev) => ({ ...prev, status }));
      setSlugTouched(true);
      showSuccess(status === "published" ? (savedStatus === "published" ? "Saved" : "Published") : "Saved as draft");
      if (previewWindow) previewWindow.location.href = `/admin/preview/work/${savedId}`;
      if (isNew) router.replace(`/admin/CaseStudies/${savedId}`);
    } catch (err) {
      previewWindow?.close();
      setError(err as ApiError);
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const moveImage = (index: number, offset: number) =>
    setForm((prev) => {
      const gallery = [...prev.gallery];
      [gallery[index], gallery[index + offset]] = [gallery[index + offset], gallery[index]];
      return { ...prev, gallery };
    });

  if (loading) return <p className="text-mutedColour">Loading…</p>;

  const seoTitle = form.seoTitle || form.title;
  const seoDescription = form.seoDescription || form.summary;
  const fieldError = (field: string) => (error?.field === field || error?.field?.startsWith(`${field}.`) ? error.message : null);

  return (
    <>
      <Link href="/admin/CaseStudies" className="text-sm text-mutedColour hover:text-accentColour">← All case studies</Link>
      <div className="mt-3">
        <PageHeader title={isNew ? "New case study" : form.title || "Case study"} description="Drafts are only visible to you. Use Preview to check the page before publishing." />
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <section className="card p-6 flex flex-col gap-4">
            <h2 className="text-lg font-FiraSans-Bold">Basics</h2>
            <TextField id="title" label="Title" required maxLength={120} counter={120} value={form.title} onChange={setTitle} />
            <div>
              <TextField
                id="slug"
                label="Slug"
                maxLength={80}
                value={form.slug}
                onChange={(value) => {
                  setSlugTouched(true);
                  set("slug", value.toLowerCase());
                }}
                help={`Page address: /work/${form.slug || "…"}${!isNew && savedStatus === "published" ? ". Changing it keeps the old address working with a redirect." : ""}`}
              />
              {fieldError("slug") && <p className="mt-1 text-sm text-errorColour">{fieldError("slug")}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField id="clientName" label="Client name" maxLength={120} value={form.clientName} onChange={(v) => set("clientName", v)} help="Leave empty if the client prefers not to be named." />
              <TextField id="industry" label="Industry" maxLength={80} value={form.industry} onChange={(v) => set("industry", v)} placeholder="Construction" />
            </div>
            <TextArea id="summary" label="Summary" rows={3} maxLength={400} counter={300} value={form.summary} onChange={(v) => set("summary", v)} help="One or two sentences. Shown on cards and used as the meta description unless you set one below." />
            <div>
              <TextField id="tech" label="Tech stack (comma separated)" maxLength={500} value={form.tech} onChange={(v) => set("tech", v)} placeholder="Next.js, PostgreSQL, Flutter" />
              <div className="mt-2 flex flex-wrap gap-2">
                {splitTags(form.tech).map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-6 flex flex-col gap-4">
            <h2 className="text-lg font-FiraSans-Bold">The story</h2>
            <TextArea id="problem" label="The problem" rows={6} maxLength={8000} value={form.problem} onChange={(v) => set("problem", v)} help={TEXT_HELP} />
            <TextArea id="solution" label="What I built" rows={8} maxLength={8000} value={form.solution} onChange={(v) => set("solution", v)} help={TEXT_HELP} />
            <TextArea id="results" label="Results and outcomes" rows={6} maxLength={8000} value={form.results} onChange={(v) => set("results", v)} help="Numbers work best: hours saved per week, errors removed, staff using it." />
          </section>

          <section className="card p-6 flex flex-col gap-4">
            <h2 className="text-lg font-FiraSans-Bold">Images</h2>
            <ImageField id="cover" label="Cover image (also used when the page is shared on social media)" value={form.cover} onChange={(v) => set("cover", v)} />
            {fieldError("cover") && <p className="text-sm text-errorColour">{fieldError("cover")}</p>}

            <h3 className="mt-2 font-FiraSans-SemiBold">Gallery</h3>
            {form.gallery.map((image, index) => (
              <ImageField
                key={`${image.src}-${index}`}
                id={`gallery-${index}`}
                label={`Image ${index + 1}`}
                value={image}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    gallery: value ? prev.gallery.map((item, i) => (i === index ? value : item)) : prev.gallery.filter((_, i) => i !== index),
                  }))
                }
                extraActions={
                  <>
                    <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveImage(index, -1)} className={`${smallButton} p-1.5!`}>
                      <MdArrowUpward />
                    </button>
                    <button type="button" aria-label="Move down" disabled={index === form.gallery.length - 1} onClick={() => moveImage(index, 1)} className={`${smallButton} p-1.5!`}>
                      <MdArrowDownward />
                    </button>
                  </>
                }
              />
            ))}
            {fieldError("gallery") && <p className="text-sm text-errorColour">{fieldError("gallery")}</p>}
            {form.gallery.length < 20 && (
              <AddGalleryImage onAdd={(image) => setForm((prev) => ({ ...prev, gallery: [...prev.gallery, image] }))} />
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-8">
          <section className="card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-FiraSans-Bold">Publishing</h2>
              <Pill tone={savedStatus === "published" ? "green" : "grey"}>{savedStatus === "published" ? "Published" : "Draft"}</Pill>
            </div>
            <Checkbox id="featured" label="Feature on the home page" checked={form.featured} onChange={(v) => set("featured", v)} />
            {fieldError("status") && <p className="text-sm text-errorColour">{fieldError("status")}</p>}
            <div className="flex flex-col gap-2">
              {savedStatus === "published" ? (
                <>
                  <button type="button" disabled={saving} onClick={() => save("published")} className="btn-primary disabled:opacity-50">Save changes</button>
                  <button type="button" disabled={saving} onClick={() => save("draft")} className="btn-secondary disabled:opacity-50">Unpublish (back to draft)</button>
                </>
              ) : (
                <>
                  <button type="button" disabled={saving} onClick={() => save("draft")} className="btn-secondary disabled:opacity-50">Save draft</button>
                  <button type="button" disabled={saving} onClick={() => save("draft", { preview: true })} className="btn-secondary disabled:opacity-50">Save and preview</button>
                  <button type="button" disabled={saving} onClick={() => save("published")} className="btn-primary disabled:opacity-50">Publish</button>
                </>
              )}
              {!isNew && savedStatus === "published" && (
                <a href={`/work/${form.slug}`} target="_blank" rel="noreferrer" className="text-sm text-accentColour text-center underline underline-offset-4">View live page</a>
              )}
              {!isNew && savedStatus === "published" && (
                <a href={`/admin/preview/work/${id}`} target="_blank" rel="noreferrer" className="text-sm text-mutedColour text-center underline underline-offset-4">Preview saved version</a>
              )}
            </div>
          </section>

          <section className="card p-6 flex flex-col gap-4">
            <h2 className="text-lg font-FiraSans-Bold">Search engines</h2>
            <TextField id="seoTitle" label="SEO title (optional)" maxLength={70} counter={60} value={form.seoTitle} onChange={(v) => set("seoTitle", v)} placeholder={form.title} help="Defaults to the title. Around 50–60 characters." />
            <TextArea id="seoDescription" label="Meta description (optional)" rows={3} maxLength={170} counter={155} value={form.seoDescription} onChange={(v) => set("seoDescription", v)} placeholder={form.summary} help="Defaults to the summary. Around 120–155 characters." />
            <div className="rounded-lg bg-white p-4 text-sm" aria-label="Search result preview">
              <p className="text-[#1a0dab] text-lg leading-snug truncate">{seoTitle || "Title"}</p>
              <p className="text-[#006621] truncate">{typeof window === "undefined" ? "" : window.location.host} › work › {form.slug || "…"}</p>
              <p className="text-[#545454] line-clamp-2">{seoDescription || "Description"}</p>
            </div>
          </section>
        </div>
      </form>
    </>
  );
}

function AddGalleryImage({ onAdd }: { onAdd: (image: ImageValue) => void }) {
  // A fresh field each time; it hands the image over once uploaded
  const [key, setKey] = useState(0);
  return (
    <ImageField
      key={key}
      id={`gallery-new-${key}`}
      label="Add an image"
      value={null}
      onChange={(image) => {
        if (image) {
          onAdd(image);
          setKey((k) => k + 1);
        }
      }}
    />
  );
}
