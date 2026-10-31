"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MdArrowDownward, MdArrowUpward } from "react-icons/md";
import type { Client, Contract, HandoverFile, Invoice, Payment, Project, ProjectUpdate, SupportRequest } from "@/lib/query/clients.query";
import JobInvoices from "../../components/jobInvoices";
import JobHandover from "../../components/jobHandover";
import type { MilestoneView } from "@/lib/portal";
import type { SiteSettings } from "@/lib/siteSettings";
import { formatDate, formatDateTime, formatPence, penceToInput } from "@/lib/format";
import { hostingFee, monthlyCost } from "@/lib/hosting";
import { PROJECT_PRESETS, TYPICAL_HOSTING_COSTS } from "@/lib/projectPresets";
import PresetPreview from "../../components/presetPreview";
import ContractView from "@/app/components/contractView";
import PageHeader from "../../components/pageHeader";
import { api, ApiError, showError, showSuccess } from "../../components/api";
import { Checkbox, dangerButton, Pill, smallButton, TextArea, TextField } from "../../components/fields";

interface JobData {
  project: Project;
  client: Client;
  milestones: MilestoneView[];
  updates: ProjectUpdate[];
  contracts: Contract[];
  supportRequests: SupportRequest[];
  supportEndsOn: string | null;
  payments: Payment[];
  cardReady: boolean;
  invoices: Invoice[];
  handoverFiles: HandoverFile[];
  handoverReleased: boolean;
}

const MILESTONE_TONES = {
  complete: ["Complete", "green"],
  in_progress: ["In progress", "blue"],
  payment_due: ["Payment requested", "amber"],
  payment_reported: ["Client says paid: check your bank", "amber"],
  paid_ready: ["Paid, ready to start", "green"],
  on_hold: ["On hold (earlier payment outstanding)", "grey"],
  upcoming: ["Not started", "grey"],
} as const;

export default function JobPage() {
  const id = useParams<{ id: string }>()?.id ?? "";
  const [data, setData] = useState<JobData | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const load = useCallback(() => api<JobData>(`/api/admin/projects?id=${encodeURIComponent(id)}`).then(setData).catch(showError), [id]);

  useEffect(() => {
    load();
    api<SiteSettings>("/api/admin/settings").then(setSettings).catch(showError);
  }, [load]);

  if (!data) return <p className="text-mutedColour">Loading…</p>;
  const { project, client } = data;

  return (
    <>
      <Link href="/admin/Jobs" className="text-sm text-mutedColour hover:text-accentColour">← All jobs</Link>
      <div className="mt-3">
        <PageHeader title={project.title} description={`${project.reference} · for ${client.name}${client.company ? `, ${client.company}` : ""}`} />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_440px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <Milestones data={data} settings={settings} reload={load} />
          <Contracts data={data} reload={load} />
          <JobInvoices project={project} invoices={data.invoices} reload={load} />
          <JobHandover key={project.updatedAt} project={project} files={data.handoverFiles} released={data.handoverReleased} reload={load} />
          <Updates data={data} reload={load} />
        </div>
        <div className="flex flex-col gap-6">
          <ProjectDetails key={project.updatedAt} data={data} settings={settings} reload={load} />
          <Support data={data} reload={load} />
          <div className="card p-6 text-sm">
            <h2 className="text-lg font-FiraSans-Bold">Client</h2>
            <p className="mt-2">
              <Link href={`/admin/Clients/${client.id}`} className="text-accentColour hover:underline">{client.name}</Link>
            </p>
            <p className="text-mutedColour">{client.email}{client.phone ? ` · ${client.phone}` : ""}</p>
            <p className="mt-2 text-mutedColour">They see this job at /portal/projects/{project.id}. Send them an invite from their client page.</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- Project details ----

interface CostRow {
  label: string;
  amount: string;
  period: "month" | "year";
}

function ProjectDetails({ data, settings, reload }: { data: JobData; settings: SiteSettings | null; reload: () => Promise<unknown> }) {
  const router = useRouter();
  const { project } = data;
  const [values, setValues] = useState({
    title: project.title,
    summary: project.summary,
    status: project.status,
    totalPrice: penceToInput(project.totalPrice),
    supportMonths: String(project.supportMonths),
    completedAt: project.completedAt ?? "",
    supportExtendedUntil: project.supportExtendedUntil ?? "",
    hostingPaidUntil: project.hostingPaidUntil ?? "",
    paymentTiming: project.paymentTiming,
  });
  const [allowCard, setAllowCard] = useState(project.allowCard);
  const [costs, setCosts] = useState<CostRow[]>(project.hostingCosts.map((c) => ({ ...c, amount: penceToInput(c.amount) })));
  const [saving, setSaving] = useState(false);
  const markup = Number(settings?.hostingMarkupPercent ?? 10);
  // Same sums as the server, which works the fee out again when saving
  const parsedCosts = costs.map((c) => ({ ...c, amount: Math.round(Number(c.amount.replace(/[£,\s]/g, "")) * 100) || 0 }));
  const fee = hostingFee(parsedCosts, markup);
  const setCost = (index: number, patch: Partial<CostRow>) => setCosts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const set = (key: keyof typeof values, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/admin/projects", "PUT", { id: project.id, ...values, allowCard, hostingCosts: costs });
      showSuccess("Saved");
      await reload();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${project.title}" and all its milestones and updates?`)) return;
    try {
      await api("/api/admin/projects", "DELETE", { id: project.id });
      router.push("/admin/Jobs");
    } catch (error) {
      showError(error);
    }
  };

  return (
    <form onSubmit={save} className="card p-6 flex flex-col gap-4">
      <h2 className="text-lg font-FiraSans-Bold">Project</h2>
      <TextField id="p-title" label="Title" required maxLength={150} value={values.title} onChange={(v) => set("title", v)} />
      <div>
        <label htmlFor="p-status" className="block mb-1 text-sm font-FiraSans-SemiBold">Status</label>
        <select id="p-status" value={values.status} onChange={(e) => set("status", e.target.value)} className="admin-input">
          <option value="planning">Planning</option>
          <option value="in_progress">In progress</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <TextField id="p-price" label="Total price (£)" value={values.totalPrice} onChange={(v) => set("totalPrice", v)} />
      <fieldset className="rounded-lg border border-borderColour p-4 flex flex-col gap-3">
        <legend className="px-1 text-sm font-FiraSans-SemiBold">Payments</legend>
        <div>
          <label htmlFor="p-timing" className="block mb-1 text-sm font-FiraSans-SemiBold">When is each stage paid?</label>
          <select id="p-timing" value={values.paymentTiming} onChange={(e) => set("paymentTiming", e.target.value)} className="admin-input">
            <option value="before">Before it starts (safest for you)</option>
            <option value="after">When it&apos;s delivered, before the next one starts</option>
          </select>
        </div>
        <Checkbox
          id="p-card"
          label="Let the client pay by card (Stripe)"
          checked={allowCard}
          onChange={setAllowCard}
          help={data.cardReady ? "Bank transfer is always offered too. Card fees follow Settings → Card payments." : "Stripe isn't set up yet: add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Until then clients only see bank transfer."}
        />
      </fieldset>
      <TextArea id="p-summary" label="Scope" rows={6} value={values.summary} onChange={(v) => set("summary", v)} help="Used as {{projectSummary}} in the contract." />
      <div className="grid grid-cols-2 gap-4">
        <TextField id="p-support" label="Free support (months)" type="number" value={values.supportMonths} onChange={(v) => set("supportMonths", v)} />
        <TextField id="p-completed" label="Completed on" type="date" value={values.completedAt} onChange={(v) => set("completedAt", v)} />
      </div>
      <TextField id="p-extended" label="Support extended until (optional)" type="date" value={values.supportExtendedUntil} onChange={(v) => set("supportExtendedUntil", v)} help="Set this when a client pays for extended support." />
      {data.supportEndsOn && <p className="text-sm text-mutedColour">Support currently ends {formatDate(data.supportEndsOn)}.</p>}
      <fieldset className="rounded-lg border border-borderColour p-4 flex flex-col gap-3">
        <legend className="px-1 text-sm font-FiraSans-SemiBold">Hosting (optional)</legend>
        <p className="text-xs text-mutedColour">
          List what it costs you to run. The client pays that plus {markup}% each month. Leave empty if they host it themselves.
        </p>
        {costs.map((cost, index) => (
          <div key={index} className="grid grid-cols-[1fr_80px_130px_auto] gap-2 items-center">
            <input aria-label="Cost name" value={cost.label} maxLength={80} placeholder="e.g. Server (VPS)" onChange={(e) => setCost(index, { label: e.target.value })} className="admin-input py-2!" />
            <input aria-label="Amount in pounds" value={cost.amount} inputMode="decimal" placeholder="£" onChange={(e) => setCost(index, { amount: e.target.value })} className="admin-input py-2!" />
            <select aria-label="Billing period" value={cost.period} onChange={(e) => setCost(index, { period: e.target.value as CostRow["period"] })} className="admin-input py-2!">
              <option value="month">per month</option>
              <option value="year">per year</option>
            </select>
            <button type="button" aria-label="Remove cost" className="text-errorColour px-2" onClick={() => setCosts((prev) => prev.filter((_, i) => i !== index))}>✕</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={smallButton} onClick={() => setCosts((prev) => [...prev, { label: "", amount: "", period: "month" }])}>Add a cost</button>
          {costs.length === 0 && (
            <button type="button" className={smallButton} onClick={() => setCosts(TYPICAL_HOSTING_COSTS.map((c) => ({ ...c, amount: penceToInput(c.amount) })))}>
              Add typical costs
            </button>
          )}
        </div>
        {costs.length > 0 && (
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-mutedColour">Your costs per month</dt>
            <dd className="text-right">{formatPence(Math.round(monthlyCost(parsedCosts)))}</dd>
            <dt className="text-mutedColour">Plus {markup}%</dt>
            <dd className="text-right">{formatPence(fee - Math.round(monthlyCost(parsedCosts)))}</dd>
            <dt className="font-FiraSans-Bold">Client pays per month</dt>
            <dd className="text-right font-FiraSans-Bold">{formatPence(fee)}</dd>
          </dl>
        )}
        {project.hostingMonthly !== fee && project.hostingMonthly > 0 && (
          <p className="text-xs text-warningColour">Saved fee is {formatPence(project.hostingMonthly)}. Save to update it. Contracts already sent keep their old figure.</p>
        )}
        <TextField id="p-hosting-paid" label="Hosting paid until" type="date" value={values.hostingPaidUntil} onChange={(v) => set("hostingPaidUntil", v)} help="Move this on each time they pay." />
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={remove} className={`${dangerButton} ml-auto`}>Delete job</button>
      </div>
    </form>
  );
}

// " by card (+£1.20 fee)" / " by bank transfer"
function paymentNote(payments: Payment[], milestoneId: number) {
  const payment = payments.find((p) => p.milestoneId === milestoneId);
  if (!payment) return "";
  return payment.method === "card" ? ` by card${payment.fee ? ` (+${formatPence(payment.fee)} fee)` : ""}` : " by bank transfer";
}

// ---- Milestones ----

const EMPTY_MILESTONE = { title: "", description: "", amount: "", requiresPayment: true, dueDate: "" };

// One-click starting points for single milestones; the amount is left for you to fill in
const MILESTONE_TEMPLATES = [
  { title: "Deposit", description: "Paid before work starts. It books the project into my schedule." },
  { title: "Discovery and design", description: "We agree the screens, data and workflows. You sign off the design before building starts." },
  { title: "Build and testing", description: "The system is built and you test it with real data on a private test site." },
  { title: "Data migration", description: "Existing records are moved across from your current spreadsheets or system and checked with you." },
  { title: "Training", description: "Your team is shown how to use the system, with a short guide to keep." },
  { title: "Launch", description: "The system goes live. Your free support period starts here." },
  { title: "Change request", description: "Extra work agreed after the contract was signed." },
];

function Milestones({ data, settings, reload }: { data: JobData; settings: SiteSettings | null; reload: () => Promise<unknown> }) {
  const { project, milestones } = data;
  const [form, setForm] = useState(EMPTY_MILESTONE);
  const [presetId, setPresetId] = useState(PROJECT_PRESETS[0].id);
  const depositPercent = Number(settings?.depositPercent ?? 25);
  // Templates can only replace milestones while nothing has been started, invoiced or paid
  const canUsePreset = milestones.every((m) => m.status === "upcoming" && !m.paidAt && !m.paymentRequestedAt);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const contractSigned = data.contracts.some((c) => c.status === "signed");
  const total = milestones.reduce((sum, m) => sum + m.amount, 0);
  const editable = milestones.every((m) => m.status === "upcoming");

  const run = async (method: string, body: object, message?: string) => {
    try {
      await api("/api/admin/milestones", method, body);
      if (message) showSuccess(message);
      await reload();
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/admin/milestones", editingId ? "PUT" : "POST", editingId ? { id: editingId, ...form } : { projectId: project.id, ...form });
      showSuccess(editingId ? "Milestone saved" : "Milestone added");
      setForm(EMPTY_MILESTONE);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err as ApiError);
      showError(err);
    }
  };

  const applyPreset = async () => {
    const preset = PROJECT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const question = milestones.length
      ? `Replace the ${milestones.length} current milestone(s) with the "${preset.label}" template?`
      : `Add the "${preset.label}" milestones, splitting ${formatPence(project.totalPrice)} between them?`;
    if (!window.confirm(`${question} You can edit them afterwards.`)) return;
    try {
      await api("/api/admin/projects", "PATCH", { id: project.id, presetId, replace: milestones.length > 0 });
      showSuccess("Milestones added");
      await reload();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-FiraSans-Bold">Milestones</h2>
        <p className={`text-sm ${total !== project.totalPrice ? "text-warningColour" : "text-mutedColour"}`}>
          {formatPence(total)} of {formatPence(project.totalPrice)} allocated
        </p>
      </div>
      {canUsePreset && (
        <div className="mt-4 rounded-lg border border-accentColour/40 bg-accentColour/5 p-4">
          <label htmlFor="m-preset" className="block text-sm font-FiraSans-SemiBold">
            {milestones.length ? "Start again from a milestone template" : "Start from a milestone template"}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <select id="m-preset" value={presetId} onChange={(e) => setPresetId(e.target.value)} className="admin-input w-auto! py-2!">
              {PROJECT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <button type="button" className="btn-primary py-2!" onClick={applyPreset} disabled={!project.totalPrice}>
              {milestones.length ? "Replace milestones" : "Use this template"}
            </button>
          </div>
          <div className="mt-3">
            <PresetPreview presetId={presetId} totalPrice={project.totalPrice} depositPercent={depositPercent} />
          </div>
          {!project.totalPrice && <p className="mt-2 text-xs text-warningColour">Set the total price under Project first, so it can be split into stages.</p>}
        </div>
      )}

      {!contractSigned && milestones.length > 0 && (
        <p className="mt-2 text-sm text-warningColour">Work can&apos;t start until the contract is signed. Set the milestones first; they go into the contract.</p>
      )}

      <ol className="mt-4 flex flex-col gap-3">
        {milestones.length === 0 && <li className="text-mutedColour">No milestones yet. Use a template above, or add them one by one below.</li>}
        {milestones.map((m, index) => {
          const [label, tone] = MILESTONE_TONES[m.display];
          return (
            <li key={m.id} className={`rounded-lg border bg-backgroundColour p-4 ${editingId === m.id ? "border-accentColour" : "border-borderColour"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <p className="font-FiraSans-Bold">{index + 1}. {m.title}</p>
                  <p className="text-sm text-mutedColour">
                    {[
                      formatPence(m.amount),
                      m.requiresPayment
                        ? `${project.paymentTiming === "before" ? "paid before it starts" : "paid on delivery"} · ref ${m.paymentReference}`
                        : "no payment needed",
                      m.dueDate && `target ${formatDate(m.dueDate)}`,
                      m.paidAt && `paid ${formatDate(m.paidAt)}${paymentNote(data.payments, m.id)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Pill tone={tone}>{label}</Pill>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(m.display === "upcoming" || m.display === "paid_ready") && !(project.paymentTiming === "before" && m.requiresPayment && !m.paidAt) && (
                  <button type="button" className={smallButton} onClick={() => run("PATCH", { id: m.id, action: "start" }, "Started")}>Start</button>
                )}
                {m.requiresPayment && !m.paidAt && m.status !== "awaiting_payment" && (
                  <button type="button" className={smallButton} onClick={() => window.confirm(`Email ${data.client.name} asking for ${formatPence(m.amount)}?`) && run("PATCH", { id: m.id, action: "request_payment" }, "Payment requested")}>
                    Request payment
                  </button>
                )}
                {m.status === "awaiting_payment" && (
                  <>
                    <button type="button" className="rounded-md border border-successColour/50 px-3 py-1 text-sm text-successColour hover:bg-successColour/10" onClick={() => window.confirm(`Confirm ${formatPence(m.amount)} has arrived in your bank?`) && run("PATCH", { id: m.id, action: "confirm_payment" }, "Payment confirmed")}>
                      Confirm payment received
                    </button>
                    <button type="button" className={smallButton} onClick={() => run("PATCH", { id: m.id, action: "reset" }, "Payment request withdrawn")}>Withdraw request</button>
                  </>
                )}
                {m.status === "in_progress" && (!m.requiresPayment || m.paidAt) && (
                  <button type="button" className={smallButton} onClick={() => run("PATCH", { id: m.id, action: "complete" }, "Completed")}>Mark complete</button>
                )}
                {m.status !== "awaiting_payment" && !m.paidAt && (
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => {
                      setEditingId(m.id);
                      setForm({ title: m.title, description: m.description, amount: penceToInput(m.amount), requiresPayment: m.requiresPayment, dueDate: m.dueDate ?? "" });
                    }}
                  >
                    Edit
                  </button>
                )}
                {editable && (
                  <>
                    <button type="button" aria-label="Move up" disabled={index === 0} className={`${smallButton} p-1.5!`} onClick={() => run("PATCH", { id: m.id, move: "up" })}><MdArrowUpward /></button>
                    <button type="button" aria-label="Move down" disabled={index === milestones.length - 1} className={`${smallButton} p-1.5!`} onClick={() => run("PATCH", { id: m.id, move: "down" })}><MdArrowDownward /></button>
                  </>
                )}
                {!m.paidAt && (
                  <button type="button" className={`${dangerButton} ml-auto`} onClick={() => window.confirm(`Delete "${m.title}"?`) && run("DELETE", { id: m.id }, "Deleted")}>Delete</button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <form onSubmit={submit} className="mt-6 pt-6 border-t border-borderColour grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-FiraSans-Bold">{editingId ? "Edit milestone" : "Add a milestone"}</h3>
          {!editingId && (
            <div className="flex flex-wrap gap-1.5" aria-label="Milestone templates">
              {MILESTONE_TEMPLATES.map((template) => (
                <button
                  key={template.title}
                  type="button"
                  className="rounded-full border border-borderColour px-3 py-1 text-xs hover:border-accentColour hover:text-accentColour"
                  onClick={() =>
                    setForm({
                      ...EMPTY_MILESTONE,
                      ...template,
                      title: template.title === "Deposit" ? `Deposit (${depositPercent}%)` : template.title,
                      amount: template.title === "Deposit" && project.totalPrice ? penceToInput(Math.round((project.totalPrice * depositPercent) / 100)) : "",
                    })
                  }
                >
                  + {template.title}
                </button>
              ))}
            </div>
          )}
        </div>
        <TextField id="m-title" label="Title" required maxLength={150} value={form.title} onChange={(title) => setForm((f) => ({ ...f, title }))} />
        <TextField id="m-amount" label="Amount (£)" value={form.amount} onChange={(amount) => setForm((f) => ({ ...f, amount }))} placeholder="1500" />
        <div className="md:col-span-2">
          <TextArea id="m-description" label="What's delivered (shown to the client)" rows={3} maxLength={3000} value={form.description} onChange={(description) => setForm((f) => ({ ...f, description }))} />
        </div>
        <TextField id="m-due" label="Target date (optional)" type="date" value={form.dueDate} onChange={(dueDate) => setForm((f) => ({ ...f, dueDate }))} />
        <div className="self-center">
          <Checkbox id="m-pay" label="Must be paid before the next milestone starts" checked={form.requiresPayment} onChange={(requiresPayment) => setForm((f) => ({ ...f, requiresPayment }))} />
        </div>
        {error && <p className="md:col-span-2 text-sm text-errorColour">{error.message}</p>}
        <div className="md:col-span-2 flex gap-2">
          <button type="submit" className="btn-primary">{editingId ? "Save milestone" : "Add milestone"}</button>
          {editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(EMPTY_MILESTONE); }}>Cancel</button>}
        </div>
      </form>
    </section>
  );
}

// ---- Contracts ----

function Contracts({ data, reload }: { data: JobData; reload: () => Promise<unknown> }) {
  const { project, contracts } = data;
  const [editing, setEditing] = useState<{ id: number; title: string; body: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const hasActive = contracts.some((c) => c.status !== "void");

  const run = async (method: string, body: object, message: string) => {
    try {
      await api("/api/admin/contracts", method, body);
      showSuccess(message);
      await reload();
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  const create = async () => {
    try {
      const { id } = await api<{ id: number }>("/api/admin/contracts", "POST", { projectId: project.id });
      await reload();
      const fresh = await api<JobData>(`/api/admin/projects?id=${project.id}`);
      const contract = fresh.contracts.find((c) => c.id === id);
      if (contract) setEditing({ id, title: contract.title, body: contract.body });
    } catch (error) {
      showError(error);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-FiraSans-Bold">Contract</h2>
        {!hasActive && <button type="button" className={smallButton} onClick={create}>Create from template</button>}
      </div>
      <p className="mt-1 text-sm text-mutedColour">
        The template is filled in with this job&apos;s client, price and milestones, so add those first. Edit the template under Settings.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {contracts.map((contract) => (
          <li key={contract.id} className="rounded-lg border border-borderColour bg-backgroundColour p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <p className="font-FiraSans-Bold">{contract.title}</p>
                <p className="text-sm text-mutedColour">
                  {contract.status === "draft" && "Draft: the client can't see it yet"}
                  {contract.status === "sent" && `Sent ${formatDateTime(contract.sentAt!)}, waiting for signature`}
                  {contract.status === "signed" && `Signed by ${contract.signedName} on ${formatDateTime(contract.signedAt!)} from ${contract.signedIp}`}
                  {contract.status === "void" && "Voided"}
                </p>
              </div>
              <Pill tone={contract.status === "signed" ? "green" : contract.status === "sent" ? "amber" : "grey"}>{contract.status}</Pill>
            </div>

            {editing?.id === contract.id ? (
              <div className="mt-4 flex flex-col gap-3">
                <TextField id="c-title" label="Title" maxLength={200} value={editing.title} onChange={(title) => setEditing((e) => e && { ...e, title })} />
                <TextArea id="c-body" label="Contract text" rows={24} maxLength={60000} className="font-mono text-sm" value={editing.body} onChange={(body) => setEditing((e) => e && { ...e, body })} help='"## " starts a heading, "- " a bullet point. Fill in anything in [square brackets] before sending.' />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={async () => (await run("PUT", editing, "Draft saved")) && setEditing(null)}>Save draft</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Close</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {contract.status === "draft" && (
                  <>
                    <button type="button" className={smallButton} onClick={() => setEditing({ id: contract.id, title: contract.title, body: contract.body })}>Edit</button>
                    <button
                      type="button"
                      className={smallButton}
                      title="Fill the draft in again from the template, your settings, this client and the milestones"
                      onClick={() => window.confirm("Rebuild this draft from the template? Any edits you made to it will be replaced.") && run("PATCH", { id: contract.id, action: "rebuild" }, "Draft rebuilt")}
                    >
                      Rebuild from template
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-accentColour/60 px-3 py-1 text-sm text-accentColour hover:bg-accentColour/10"
                      onClick={() => window.confirm(`Send this contract to ${data.client.email}? It can't be edited after sending.`) && run("PATCH", { id: contract.id, action: "send" }, "Contract sent")}
                    >
                      Send to client
                    </button>
                    <button type="button" className={`${dangerButton} ml-auto`} onClick={() => window.confirm("Delete this draft?") && run("DELETE", { id: contract.id }, "Draft deleted")}>Delete draft</button>
                  </>
                )}
                {contract.status !== "draft" && (
                  <button type="button" className={smallButton} onClick={() => setOpen(open === contract.id ? null : contract.id)}>{open === contract.id ? "Hide" : "View"}</button>
                )}
                {contract.status === "sent" && (
                  <button type="button" className={`${dangerButton} ml-auto`} onClick={() => window.confirm("Void this contract? The client will no longer be able to sign it.") && run("PATCH", { id: contract.id, action: "void" }, "Contract voided")}>Void</button>
                )}
              </div>
            )}
            {open === contract.id && <ContractView contract={contract} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Updates ----

function Updates({ data, reload }: { data: JobData; reload: () => Promise<unknown> }) {
  const [body, setBody] = useState("");
  const [notify, setNotify] = useState(true);
  const [posting, setPosting] = useState(false);

  const post = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPosting(true);
    try {
      await api("/api/admin/updates", "POST", { projectId: data.project.id, body, notify });
      showSuccess(notify ? "Update posted and emailed" : "Update posted");
      setBody("");
      await reload();
    } catch (error) {
      showError(error);
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this update?")) return;
    try {
      await api("/api/admin/updates", "DELETE", { id });
      await reload();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-FiraSans-Bold">Progress updates</h2>
      <form onSubmit={post} className="mt-4 flex flex-col gap-3">
        <TextArea id="u-body" label="New update (shown in the client's portal)" rows={4} maxLength={5000} value={body} onChange={setBody} />
        <Checkbox id="u-notify" label="Email it to the client too" checked={notify} onChange={setNotify} />
        <div>
          <button type="submit" disabled={posting || !body.trim()} className="btn-primary disabled:opacity-50">{posting ? "Posting…" : "Post update"}</button>
        </div>
      </form>
      <ul className="mt-6 flex flex-col gap-3">
        {data.updates.map((update) => (
          <li key={update.id} className="rounded-lg border border-borderColour bg-backgroundColour p-4">
            <div className="flex justify-between gap-3">
              <p className="text-xs text-mutedColour">{update.createdAt ? formatDateTime(update.createdAt) : ""}</p>
              <button type="button" className="text-xs text-errorColour hover:underline" onClick={() => remove(update.id)}>Delete</button>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm">{update.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Support requests ----

function Support({ data, reload }: { data: JobData; reload: () => Promise<unknown> }) {
  if (data.supportRequests.length === 0) return null;

  const handled = async (id: number) => {
    try {
      await api("/api/admin/projects", "PATCH", { supportRequestId: id });
      await reload();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-FiraSans-Bold">Support requests</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {data.supportRequests.map((request) => (
          <li key={request.id} className={`rounded-lg border border-borderColour bg-backgroundColour p-4 text-sm ${request.status === "handled" ? "opacity-60" : ""}`}>
            <p className="font-FiraSans-Bold capitalize">{request.plan} plan · {request.months} months</p>
            <p className="text-xs text-mutedColour">{request.createdAt ? formatDateTime(request.createdAt) : ""}</p>
            {request.message && <p className="mt-2 whitespace-pre-line">{request.message}</p>}
            {request.status === "new" && (
              <button type="button" className={`${smallButton} mt-3`} onClick={() => handled(request.id)}>Mark as handled</button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-mutedColour">Once they&apos;ve paid, set &ldquo;Support extended until&rdquo; on the project.</p>
    </section>
  );
}
