import Link from "next/link";
import { requirePortalClient } from "@/lib/session";
import { ListMilestones, ListProjects } from "@/lib/query/clients.query";
import { describeMilestones } from "@/lib/portal";
import { PROJECT_LABELS, StatusPill } from "./components/status";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const client = await requirePortalClient();
  const projects = ListProjects(client.id).filter((project) => project.status !== "cancelled");

  return (
    <>
      <h1 className="text-3xl font-FiraSans-ExtraBold">Hi {client.name.split(" ")[0]}</h1>
      <p className="mt-2 text-mutedColour">Here are your projects. Choose one to see its progress, payments and contract.</p>

      {projects.length === 0 ? (
        <p className="mt-8 card p-6 text-mutedColour">Your project will appear here once it&apos;s set up.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((project) => {
            const milestones = describeMilestones(project, ListMilestones(project.id));
            const done = milestones.filter((m) => m.display === "complete").length;
            const due = milestones.some((m) => m.display === "payment_due");
            const [label, colour] = PROJECT_LABELS[project.status];
            return (
              <li key={project.id} className="card p-6 relative hover:border-accentColour/60">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-FiraSans-Bold">
                    <Link href={`/portal/projects/${project.id}`} className="after:absolute after:inset-0">{project.title}</Link>
                  </h2>
                  <StatusPill label={label} colour={colour} />
                </div>
                <p className="mt-1 text-sm text-mutedColour">{project.reference}</p>
                {milestones.length > 0 && (
                  <p className="mt-4 text-sm text-mutedColour">{done} of {milestones.length} stages complete</p>
                )}
                {due && <p className="mt-2 text-sm text-warningColour">A payment is due</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
