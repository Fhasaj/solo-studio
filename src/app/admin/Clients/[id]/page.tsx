"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Client, ProjectListItem } from "@/lib/query/clients.query";
import { formatPence } from "@/lib/format";
import { PROJECT_PRESETS } from "@/lib/projectPresets";
import PageHeader from "../../components/pageHeader";
import ClientForm from "../../components/clientForm";
import { api, showError, showSuccess } from "../../components/api";
import { dangerButton, Pill, smallButton, TextArea, TextField } from "../../components/fields";

export default function ClientPage() {
  const id = useParams<{ id: string }>()?.id ?? "";
  const router = useRouter();
  const [data, setData] = useState<{ client: Client; projects: ProjectListItem[] } | null>(null);
  const [project, setProject] = useState({ title: "", totalPrice: "", summary: "", presetId: PROJECT_PRESETS[0].id });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => api<{ client: Client; projects: ProjectListItem[] }>(`/api/admin/clients?id=${encodeURIComponent(id)}`).then(setData).catch(showError), [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-mutedColour">Loading…</p>;
  const { client, projects } = data;

  const invite = async () => {
    try {
      const { sent } = await api<{ sent: boolean }>("/api/admin/clients", "PATCH", { id: client.id });
      if (sent) showSuccess(`Invite sent to ${client.email}`);
      else showError(new Error("The invite email couldn't be sent. Check the EMAIL_* settings."));
    } catch (error) {
      showError(error);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${client.name}? This can't be undone.`)) return;
    try {
      await api("/api/admin/clients", "DELETE", { id: client.id });
      router.push("/admin/Clients");
    } catch (error) {
      showError(error);
    }
  };

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { id: projectId } = await api<{ id: number }>("/api/admin/projects", "POST", { clientId: client.id, ...project });
      router.push(`/admin/Jobs/${projectId}`);
    } catch (error) {
      showError(error);
      setCreating(false);
    }
  };

  return (
    <>
      <Link href="/admin/Clients" className="text-sm text-mutedColour hover:text-accentColour">← All clients</Link>
      <div className="mt-3">
        <PageHeader title={client.name} description={[client.company, client.email].filter(Boolean).join(" · ")} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="card p-6">
          <h2 className="mb-4 text-xl font-FiraSans-Bold">Details</h2>
          <ClientForm
            key={JSON.stringify(client)}
            initial={client}
            submitLabel="Save"
            onSubmit={async (values) => {
              try {
                await api("/api/admin/clients", "PUT", { ...values, id: client.id });
                showSuccess("Saved");
                await load();
                return true;
              } catch (error) {
                showError(error);
                return false;
              }
            }}
          />
          <div className="mt-6 pt-4 border-t border-borderColour flex flex-wrap gap-2">
            <button type="button" className={smallButton} onClick={invite} disabled={!client.isActive}>Email portal invite</button>
            <button type="button" className={`${dangerButton} ml-auto`} onClick={remove} disabled={projects.length > 0} title={projects.length ? "Remove their projects first" : undefined}>Delete client</button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <h2 className="text-xl font-FiraSans-Bold">Projects</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {projects.length === 0 && <li className="text-mutedColour">No projects yet.</li>}
              {projects.map((p) => (
                <li key={p.id} className="rounded-lg border border-borderColour bg-backgroundColour p-4 flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/Jobs/${p.id}`} className="font-FiraSans-Bold hover:text-accentColour">{p.title}</Link>
                    <p className="text-sm text-mutedColour">{p.reference} · {formatPence(p.totalPrice)}</p>
                  </div>
                  <Pill tone={p.status === "completed" ? "green" : p.status === "in_progress" ? "blue" : "grey"}>{p.status.replace("_", " ")}</Pill>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={createProject} className="card p-6 flex flex-col gap-4">
            <h2 className="text-xl font-FiraSans-Bold">New project</h2>
            <TextField id="project-title" label="Title" required maxLength={150} value={project.title} onChange={(title) => setProject((p) => ({ ...p, title }))} />
            <div>
              <label htmlFor="project-preset" className="block mb-1 text-sm font-FiraSans-SemiBold">Preset</label>
              <select id="project-preset" value={project.presetId} onChange={(e) => setProject((p) => ({ ...p, presetId: e.target.value }))} className="admin-input">
                {PROJECT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}: {preset.description}</option>
                ))}
                <option value="">None: I&apos;ll add milestones myself</option>
              </select>
              <p className="mt-1 text-xs text-mutedColour">Adds the milestones, splits the price between them and fills in a scope outline. Everything can be edited afterwards.</p>
            </div>
            <TextField id="project-price" label="Total price (£)" required={Boolean(project.presetId)} value={project.totalPrice} onChange={(totalPrice) => setProject((p) => ({ ...p, totalPrice }))} placeholder="6000" />
            <TextArea id="project-summary" label="Scope (optional)" rows={4} value={project.summary} onChange={(summary) => setProject((p) => ({ ...p, summary }))} help="What's included; it goes into the contract. Leave empty to start from the preset's outline." />
            <div>
              <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">{creating ? "Creating…" : "Create project"}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
