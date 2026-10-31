'use client';

import { getPreset, presetMilestones } from "@/lib/projectPresets";
import { formatPence } from "@/lib/format";

// The stages a preset will create, with amounts once a price is known (same maths as the server)
export default function PresetPreview({ presetId, totalPrice, depositPercent }: { presetId: string; totalPrice: string | number; depositPercent: number }) {
  const preset = getPreset(presetId);
  if (!preset) return null;
  const pence = typeof totalPrice === "number" ? totalPrice : Math.round(Number(totalPrice.replace(/[£€,\s]/g, "")) * 100) || 0;
  const stages = presetMilestones(preset, pence, depositPercent);

  return (
    <ol className="rounded-lg border border-borderColour bg-backgroundColour p-3 text-sm flex flex-col gap-1">
      {stages.map((stage, index) => (
        <li key={stage.title} className="flex justify-between gap-3">
          <span className="text-mutedColour">{index + 1}. {stage.title}</span>
          <span className="text-textColour">{pence ? formatPence(stage.amount) : "–"}</span>
        </li>
      ))}
      <li className="mt-1 text-xs text-mutedColour">Each stage is paid before the next one starts. You can edit everything afterwards.</li>
    </ol>
  );
}
