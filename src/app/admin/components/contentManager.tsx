'use client';

import { useCallback, useEffect, useState } from "react";
import { Bounce, toast } from "react-toastify";
import { MdArrowUpward, MdArrowDownward } from "react-icons/md";
import IconPicker from "./iconPicker";
import { ServiceIconView } from "@/lib/serviceIcons";
import { CONTENT_TYPES, splitLines, splitTags, type ContentRow, type ContentType, type FieldConfig } from "@/lib/content";

interface ContentManagerProps {
  type: ContentType;
  // Builds the title and subtitle shown in the list for each item
  describe: (item: ContentRow) => { title: string; subtitle?: string };
}

const toastOptions = { position: "top-right", autoClose: 4000, hideProgressBar: true, theme: "dark", transition: Bounce } as const;

async function fetchItems(type: ContentType): Promise<ContentRow[]> {
  const res = await fetch(`/api/content/${type}`);
  const json = await res.json();
  return json.data ?? [];
}

function emptyValues(fields: readonly FieldConfig[]) {
  return Object.fromEntries(fields.map((field) => [field.name, ""])) as Record<string, string>;
}

export default function ContentManager({ type, describe }: ContentManagerProps) {
  const { label } = CONTENT_TYPES[type];
  const fields: readonly FieldConfig[] = CONTENT_TYPES[type].fields;
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>(() => emptyValues(fields));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Options for fields that link to a case study
  const [caseStudies, setCaseStudies] = useState<{ id: number; title: string; status: string }[]>([]);
  const hasCaseStudyField = fields.some((field) => field.type === "caseStudy");

  useEffect(() => {
    if (!hasCaseStudyField) return;
    fetch("/api/admin/case-studies")
      .then((res) => res.json())
      .then((json) => setCaseStudies(json.data ?? []))
      .catch(() => {});
  }, [hasCaseStudyField]);

  const load = useCallback(async () => {
    try {
      setItems(await fetchItems(type));
    } catch {
      toast.error(`Could not load ${label.toLowerCase()}`, toastOptions);
    }
  }, [type, label]);

  useEffect(() => {
    let cancelled = false;
    fetchItems(type)
      .then((data) => !cancelled && setItems(data))
      .catch(() => !cancelled && toast.error(`Could not load ${label.toLowerCase()}`, toastOptions))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type, label]);

  const request = async (method: string, body: object) => {
    const res = await fetch(`/api/content/${type}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Request failed with status ${res.status}`);
    return json;
  };

  const resetForm = () => {
    setValues(emptyValues(fields));
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId === null) {
        await request("POST", values);
        toast.success("Added", toastOptions);
      } else {
        await request("PUT", { ...values, id: editingId });
        toast.success("Saved", toastOptions);
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error((error as Error).message, toastOptions);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: ContentRow) => {
    setEditingId(item.id);
    setValues(Object.fromEntries(fields.map((field) => [field.name, String(item[field.name] ?? "")])));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const action = async (body: object, message?: string) => {
    try {
      await request("PATCH", body);
      if (message) toast.success(message, toastOptions);
      await load();
    } catch (error) {
      toast.error((error as Error).message, toastOptions);
    }
  };

  const handleDelete = async (item: ContentRow) => {
    if (!window.confirm(`Delete "${describe(item).title}"? This can't be undone.`)) return;
    try {
      await request("DELETE", { id: item.id });
      if (editingId === item.id) resetForm();
      toast.success("Deleted", toastOptions);
      await load();
    } catch (error) {
      toast.error((error as Error).message, toastOptions);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,440px)_1fr] gap-6 items-start">
      {/* Add / edit form */}
      <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4 xl:sticky xl:top-8">
        <div>
          <h2 className="text-xl font-FiraSans-Bold text-textColour">
            {editingId === null ? `Add to ${label.toLowerCase()}` : `Edit ${label.toLowerCase()} item`}
          </h2>
          <p className="mt-1 text-sm text-mutedColour">Changes show on the site straight away.</p>
        </div>

        {fields.map((field) => {
          const isMultiline = field.type === "textarea" || field.type === "lines";
          const common = {
            id: `${type}-${field.name}`,
            value: values[field.name] ?? "",
            placeholder: field.placeholder,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setValues((prev) => ({ ...prev, [field.name]: e.target.value })),
          };
          return (
            <div key={field.name}>
              <label htmlFor={common.id} className="block mb-1 text-sm font-FiraSans-SemiBold text-textColour">
                {field.label}
                {field.required && <span className="text-errorColour"> *</span>}
              </label>
              {field.type === "caseStudy" ? (
                <select id={common.id} value={common.value} onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))} className="admin-input">
                  <option value="">None</option>
                  {caseStudies.map((caseStudy) => (
                    <option key={caseStudy.id} value={String(caseStudy.id)}>
                      {caseStudy.title}{caseStudy.status === "draft" ? " (draft)" : ""}
                    </option>
                  ))}
                </select>
              ) : field.type === "icon" ? (
                <IconPicker
                  id={common.id}
                  value={common.value}
                  onChange={(icon) => setValues((prev) => ({ ...prev, [field.name]: icon }))}
                />
              ) : isMultiline ? (
                <textarea {...common} rows={field.type === "lines" ? 6 : 4} maxLength={field.maxLength} className="admin-input" />
              ) : (
                <input {...common} type="text" maxLength={field.maxLength} className="admin-input" />
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Saving…" : editingId === null ? "Add" : "Save changes"}
          </button>
          {editingId !== null && (
            <button type="button" onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Current items, in the order they appear on the site */}
      <div className="card p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-FiraSans-Bold text-textColour">On the site</h2>
          <p className="text-sm text-mutedColour">{items.length} item{items.length === 1 ? "" : "s"}</p>
        </div>
        <p className="mt-1 text-sm text-mutedColour">Shown in this order. Hidden items stay saved but don&apos;t appear on the site.</p>

        <ul className="mt-5 flex flex-col gap-3">
          {loading && <li className="text-mutedColour">Loading…</li>}
          {!loading && items.length === 0 && <li className="text-mutedColour">Nothing here yet. Add the first item with the form.</li>}
          {items.map((item, index) => {
            const { title, subtitle } = describe(item);
            const iconField = fields.find((field) => field.type === "icon");

            const preview = fields
              .filter((field) => field.type === "lines" || field.type === "tags")
              .flatMap((field) => (field.type === "lines" ? splitLines(item[field.name]) : [splitTags(item[field.name]).join(", ")]))
              .filter(Boolean)
              .slice(0, 2);

            return (
              <li
                key={item.id}
                className={`rounded-lg border p-4 bg-backgroundColour ${editingId === item.id ? "border-accentColour" : "border-borderColour"} ${item.isHidden ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex items-start gap-3">
                    {iconField && (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accentColour/10 text-lg text-accentColour">
                        <ServiceIconView name={item[iconField.name]} />
                      </span>
                    )}
                    <div className="min-w-0">
                    <p className="font-FiraSans-Bold text-textColour">{title}</p>
                    {subtitle && <p className="text-sm text-mutedColour">{subtitle}</p>}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-1 rounded-md border ${
                      item.isHidden
                        ? "bg-errorColour/10 text-errorColour border-errorColour/30"
                        : "bg-successColour/10 text-successColour border-successColour/30"
                    }`}
                  >
                    {item.isHidden ? "Hidden" : "Visible"}
                  </span>
                </div>
                {preview.length > 0 && (
                  <ul className="mt-2 text-sm text-mutedColour list-disc pl-5 marker:text-accentColour">
                    {preview.map((line) => (
                      <li key={line} className="truncate">{line}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <button type="button" onClick={() => startEdit(item)} className="rounded-md border border-borderColour px-3 py-1 hover:border-accentColour hover:text-accentColour">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => action({ id: item.id, isHidden: !item.isHidden }, item.isHidden ? "Now visible" : "Now hidden")}
                    className="rounded-md border border-borderColour px-3 py-1 hover:border-accentColour hover:text-accentColour"
                  >
                    {item.isHidden ? "Show" : "Hide"}
                  </button>
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => action({ id: item.id, move: "up" })}
                    className="rounded-md border border-borderColour p-1.5 hover:border-accentColour hover:text-accentColour disabled:opacity-30"
                  >
                    <MdArrowUpward />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === items.length - 1}
                    onClick={() => action({ id: item.id, move: "down" })}
                    className="rounded-md border border-borderColour p-1.5 hover:border-accentColour hover:text-accentColour disabled:opacity-30"
                  >
                    <MdArrowDownward />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="ml-auto rounded-md border border-errorColour/40 px-3 py-1 text-errorColour hover:bg-errorColour/10"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
