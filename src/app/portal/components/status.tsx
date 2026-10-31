import type { MilestoneDisplay } from "@/lib/portal";
import type { ProjectStatus } from "@/lib/query/clients.query";

const tone = {
  green: "bg-successColour/10 text-successColour border-successColour/30",
  blue: "bg-accentColour/10 text-accentColour border-accentColour/30",
  amber: "bg-warningColour/10 text-warningColour border-warningColour/30",
  grey: "bg-backgroundColour text-mutedColour border-borderColour",
  red: "bg-errorColour/10 text-errorColour border-errorColour/30",
};

export const MILESTONE_LABELS: Record<MilestoneDisplay, [string, keyof typeof tone]> = {
  complete: ["Complete", "green"],
  in_progress: ["In progress", "blue"],
  payment_due: ["Payment due", "amber"],
  payment_reported: ["Payment being confirmed", "amber"],
  paid_ready: ["Paid, starting soon", "green"],
  on_hold: ["On hold until payment is received", "grey"],
  upcoming: ["Not started", "grey"],
};

export const PROJECT_LABELS: Record<ProjectStatus, [string, keyof typeof tone]> = {
  planning: ["Planning", "grey"],
  in_progress: ["In progress", "blue"],
  on_hold: ["On hold", "amber"],
  completed: ["Completed", "green"],
  cancelled: ["Cancelled", "red"],
};

export function StatusPill({ label, colour }: { label: string; colour: keyof typeof tone }) {
  return <span className={`inline-block shrink-0 text-xs px-2 py-1 rounded-md border ${tone[colour]}`}>{label}</span>;
}
