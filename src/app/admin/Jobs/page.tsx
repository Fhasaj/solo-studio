"use client";

import { CURRENCY_SYMBOL } from "@/lib/currency";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Client, ProjectListItem } from "@/lib/query/clients.query";
import type { SiteSettings } from "@/lib/siteSettings";
import { formatPence } from "@/lib/format";
import { PROJECT_PRESETS } from "@/lib/projectPresets";
import PresetPreview from "../components/presetPreview";
import PageHeader from "../components/pageHeader";
import { api, showError } from "../components/api";
import { Pill, TextField } from "../components/fields";

const PROJECT_TONES = { planning: "grey", in_progress: "blue", on_hold: "amber", completed: "green", cancelled: "red" } as const;

export default function JobsPage() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);

  useEffect(() => {
    api<ProjectListItem[]>("/api/admin/projects").then(setProjects).catch(showError);
  }, []);

  return (
    <>
      <PageHeader title="Jobs" description="Client projects, their milestones and payments." />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
        <NewJob />
        <div className="card p-6">
          <h2 className="text-xl font-FiraSans-Bold">All jobs</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {projects === null && <li className="text-mutedColour">Loading…</li>}
            {projects?.length === 0 && <li className="text-mutedColour">No jobs yet. Create the first one with the form.</li>}
            {projects?.map((project) => (
              <li key={project.id} className="rounded-lg border border-borderColour bg-backgroundColour p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <Link href={`/admin/Jobs/${project.id}`} className="font-FiraSans-Bold hover:text-accentColour">{project.title}</Link>
                  <p className="text-sm text-mutedColour">
                    {project.reference} · {project.clientName}
                    {project.clientCompany && `, ${project.clientCompany}`} · {formatPence(project.totalPrice)}
                  </p>
                </div>
                <Pill tone={PROJECT_TONES[project.status]}>{project.status.replace("_", " ")}</Pill>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function NewJob() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [depositPercent, setDepositPercent] = useState(25);
  const [values, setValues] = useState({ clientId: "", title: "", totalPrice: "", presetId: PROJECT_PRESETS[0].id });
  const [creating, setCreating] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const preset = PROJECT_PRESETS.find((p) => p.id === values.presetId);

  useEffect(() => {
    api<Client[]>("/api/admin/clients")
      .then((list) => {
        const active = list.filter((c) => c.isActive);
        setClients(active);
        if (active.length === 1) setValues((prev) => ({ ...prev, clientId: String(active[0].id) }));
      })
      .catch(showError);
    api<SiteSettings>("/api/admin/settings").then((s) => setDepositPercent(Number(s.depositPercent))).catch(showError);
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { id } = await api<{ id: number }>("/api/admin/projects", "POST", values);
      router.push(`/admin/Jobs/${id}`);
    } catch (error) {
      showError(error);
      setCreating(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6 flex flex-col gap-4">
      <h2 className="text-xl font-FiraSans-Bold">New job</h2>
      {clients?.length === 0 ? (
        <p className="text-sm text-mutedColour">
          Add a client first, or turn a booking into one. <Link href="/admin/Clients" className="text-accentColour underline underline-offset-4">Go to clients</Link>
        </p>
      ) : (
        <>
          <div>
            <label htmlFor="job-client" className="block mb-1 text-sm font-FiraSans-SemiBold">Client <span className="text-errorColour">*</span></label>
            <select id="job-client" required value={values.clientId} onChange={(e) => set("clientId", e.target.value)} className="admin-input">
              <option value="">Choose a client…</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>{client.name}{client.company ? `, ${client.company}` : ""}</option>
              ))}
            </select>
          </div>
          <TextField id="job-title" label="Title" required maxLength={150} value={values.title} onChange={(v) => set("title", v)} placeholder="e.g. Job management system" />
          <TextField id="job-price" label={`Total price (${CURRENCY_SYMBOL})`} required={Boolean(values.presetId)} value={values.totalPrice} onChange={(v) => set("totalPrice", v)} placeholder="6000" />
          <div>
            <label htmlFor="job-preset" className="block mb-1 text-sm font-FiraSans-SemiBold">Milestone template</label>
            <select id="job-preset" value={values.presetId} onChange={(e) => set("presetId", e.target.value)} className="admin-input">
              {PROJECT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              <option value="">None: I&apos;ll add milestones myself</option>
            </select>
          </div>
          {preset && <PresetPreview presetId={preset.id} totalPrice={values.totalPrice} depositPercent={depositPercent} />}
          <div>
            <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">{creating ? "Creating…" : "Create job"}</button>
          </div>
        </>
      )}
    </form>
  );
}
