"use client";

import { useEffect, useState } from "react";
import { SETTING_DEFAULTS, SETTING_FIELDS, SETTING_GROUPS, type SettingField, type SettingGroup, type SiteSettings } from "@/lib/siteSettings";
import { CONTRACT_PLACEHOLDERS } from "@/lib/contractTemplate";
import type { SectionKey } from "@/lib/sections";
import PageHeader from "../components/pageHeader";
import SectionToggle from "../components/sectionToggle";
import BankDetails from "../components/bankDetails";
import AddressField from "../components/addressField";
import { api, ApiError, showError, showSuccess } from "../components/api";
import { smallButton, TextArea, TextField } from "../components/fields";

const fields = SETTING_FIELDS as readonly SettingField[];

export default function SettingsPage() {
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [values, setValues] = useState<SiteSettings | null>(null);

  useEffect(() => {
    api<SiteSettings>("/api/admin/settings")
      .then((data) => {
        setSaved(data);
        setValues(data);
      })
      .catch(showError);
  }, []);

  if (!values || !saved) return <p className="text-mutedColour">Loading…</p>;

  return (
    <>
      <PageHeader title="Settings" description="Text, prices and details used across the site, bookings, the client portal and contracts." />
      <ImportExport
        onImported={(data) => {
          setSaved(data);
          setValues(data);
        }}
      />
      <div className="flex flex-col gap-6">
        <SiteSections />
        {(Object.keys(SETTING_GROUPS) as SettingGroup[]).flatMap((group) => [
          group === "contact" ? <BankDetails key="bank" /> : null,
          <SettingsGroup
            key={group}
            group={group}
            values={values}
            saved={saved}
            onChange={(key, value) => setValues((prev) => prev && { ...prev, [key]: value })}
            onSaved={(data) => {
              setSaved(data);
              setValues((prev) => prev && { ...prev, ...pick(data, group) });
            }}
          />,
        ])}
      </div>
    </>
  );
}

const SECTIONS: { key: SectionKey; label: string; note: string }[] = [
  { key: "services", label: "Services", note: "Service cards on the home page" },
  { key: "work", label: "Case studies", note: "Featured case studies on the home page, the /work pages and the Work menu link" },
  { key: "testimonials", label: "Testimonials", note: "Client quotes on the home page" },
  { key: "pricing", label: "Pricing", note: "The pricing section on the home page" },
  { key: "faq", label: "FAQs", note: "Common questions on the home page" },
  { key: "cv", label: "CV", note: "Your CV at /cv with a PDF download, linked from the footer" },
];

// Each toggle saves straight away
function SiteSections() {
  return (
    <section className="card p-6">
      <h2 className="text-xl font-FiraSans-Bold text-textColour">Site sections</h2>
      <p className="mt-1 text-sm text-mutedColour">Choose which sections appear on the public site. Changes save straight away.</p>
      <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {SECTIONS.map((section) => (
          <li key={section.key} className="rounded-lg border border-borderColour bg-backgroundColour p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-FiraSans-SemiBold text-textColour">{section.label}</p>
              <p className="text-xs text-mutedColour">{section.note}</p>
            </div>
            <SectionToggle section={section.key} label="Shown" />
          </li>
        ))}
      </ul>
    </section>
  );
}

// The CV is Markdown: type it, or load a .md file into the box
function CvField({ value, onChange, help, maxLength }: { value: string; onChange: (value: string) => void; help?: string; maxLength?: number }) {
  const load = async (file: File) => {
    if (file.size > 200_000) return showError(new Error("That file is too big for a CV"));
    onChange(await file.text());
    showSuccess(`Loaded ${file.name}. Save to publish it.`);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className={`${smallButton} cursor-pointer`}>
          Upload a .md file
          <input type="file" accept=".md,.markdown,text/markdown,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </label>
        <a href="/cv" target="_blank" rel="noreferrer" className={smallButton}>View /cv</a>
        <a href="/cv.pdf" target="_blank" rel="noreferrer" className={smallButton}>View PDF</a>
      </div>
      <TextArea id="setting-cvMarkdown" label="CV (Markdown)" rows={26} maxLength={maxLength} value={value} onChange={onChange} help={`${help ?? ""} Save first, then view. Switch the CV on under Site sections.`} className="font-mono text-sm" />
    </div>
  );
}

// Settings as a JSON file: a backup, or a way to copy a site's setup (also usable as config/site.json)
function ImportExport({ onImported }: { onImported: (data: SiteSettings) => void }) {
  const exportSettings = async () => {
    try {
      const data = await api<SiteSettings>("/api/admin/settings");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `settings-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      showError(error);
    }
  };

  const importSettings = async (file: File) => {
    try {
      const values = JSON.parse(await file.text());
      if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("That file isn't a settings export");
      if (!window.confirm(`Replace your settings with the ${Object.keys(values).length} values in ${file.name}? Bank details aren't affected.`)) return;
      // The server checks every value, exactly as when saving a form
      onImported(await api<SiteSettings>("/api/admin/settings", "PUT", { values }));
      showSuccess("Settings imported");
    } catch (error) {
      showError(error);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <button type="button" className={smallButton} onClick={exportSettings}>Export settings</button>
      <label className={`${smallButton} cursor-pointer`}>
        Import settings
        <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importSettings(e.target.files[0])} />
      </label>
    </div>
  );
}

function pick(data: SiteSettings, group: SettingGroup) {
  return Object.fromEntries(fields.filter((f) => f.group === group).map((f) => [f.key, data[f.key as keyof SiteSettings]]));
}

interface GroupProps {
  group: SettingGroup;
  values: SiteSettings;
  saved: SiteSettings;
  onChange: (key: string, value: string) => void;
  onSaved: (data: SiteSettings) => void;
}

function SettingsGroup({ group, values, saved, onChange, onSaved }: GroupProps) {
  const groupFields = fields.filter((field) => field.group === group);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const value = (key: string) => values[key as keyof SiteSettings];
  const dirty = groupFields.some((field) => value(field.key) !== saved[field.key as keyof SiteSettings]);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await api<SiteSettings>("/api/admin/settings", "PUT", { values: Object.fromEntries(groupFields.map((f) => [f.key, value(f.key)])) });
      onSaved(data);
      showSuccess(`${SETTING_GROUPS[group].label} saved`);
    } catch (err) {
      setError(err as ApiError);
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id={group} onSubmit={save} className="card p-6 scroll-mt-24">
      <h2 className="text-xl font-FiraSans-Bold text-textColour">{SETTING_GROUPS[group].label}</h2>
      <p className="mt-1 text-sm text-mutedColour">{SETTING_GROUPS[group].description}</p>

      {group === "contract" && (
        <details className="mt-4 text-sm text-mutedColour">
          <summary className="cursor-pointer text-textColour">Placeholders you can use</summary>
          <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1">
            {CONTRACT_PLACEHOLDERS.map(([key, label]) => (
              <li key={key}>
                <code className="text-accentColour">{`{{${key}}}`}</code> {label}
              </li>
            ))}
          </ul>
          <p className="mt-2">This template is a starting point, not legal advice. Have a solicitor review it before relying on it.</p>
        </details>
      )}

      <div className={`mt-5 grid gap-4 ${group === "booking" || group === "pricing" || group === "tax" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {groupFields.map((field) => {
          const common = {
            id: `setting-${field.key}`,
            label: field.label,
            value: value(field.key),
            onChange: (v: string) => onChange(field.key, v),
            help: field.help,
            placeholder: field.placeholder,
            maxLength: field.maxLength,
          };
          const fieldError = error?.field === field.key ? <p className="mt-1 text-sm text-errorColour">{error.message}</p> : null;
          const multiline = field.type === "textarea" || field.type === "dates";
          return (
            <div key={field.key} className={multiline && group !== "pricing" ? "md:col-span-2" : ""}>
              {field.type === "select" ? (
                <div>
                  <label htmlFor={common.id} className="block mb-1 text-sm font-FiraSans-SemiBold text-textColour">{field.label}</label>
                  <select id={common.id} value={common.value} onChange={(e) => common.onChange(e.target.value)} className="admin-input">
                    {(field.options ?? []).map(([option, label]) => <option key={option} value={option}>{label}</option>)}
                  </select>
                  {field.help && <p className="mt-1 text-xs text-mutedColour">{field.help}</p>}
                </div>
              ) : field.key === "cvMarkdown" ? (
                <CvField value={common.value} onChange={common.onChange} help={field.help} maxLength={field.maxLength} />
              ) : field.key === "businessAddress" ? (
                <AddressField id={common.id} label={common.label} value={common.value} onChange={common.onChange} help={field.help} maxLength={field.maxLength} />
              ) : multiline ? (
                <TextArea {...common} rows={field.key === "contractTemplate" ? 30 : field.type === "dates" ? 4 : 3} className={field.key === "contractTemplate" ? "font-mono text-sm" : ""} />
              ) : (
                <TextField {...common} type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "date" ? "date" : "text"} />
              )}
              {fieldError}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || !dirty} className="btn-primary disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        {group === "contract" && value("contractTemplate") !== SETTING_DEFAULTS.contractTemplate && (
          <button type="button" className={smallButton} onClick={() => window.confirm("Replace your template with the original one?") && onChange("contractTemplate", SETTING_DEFAULTS.contractTemplate)}>
            Restore the original template
          </button>
        )}
        {dirty && <span className="text-sm text-warningColour">Unsaved changes</span>}
      </div>
    </form>
  );
}
