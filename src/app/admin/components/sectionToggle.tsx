'use client';

import { useEffect, useState } from "react";
import { Bounce, toast } from "react-toastify";
import type { SectionKey } from "@/lib/sections";

interface SectionToggleProps {
  section: SectionKey;
  label?: string;
}

export default function SectionToggle({ section, label = "Show on site" }: SectionToggleProps) {
  const [isVisible, setIsVisible] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/sections")
      .then((res) => res.json())
      .then((json) => setIsVisible(Boolean(json.data?.[section])))
      .catch(() => setIsVisible(null));
  }, [section]);

  const toggle = async () => {
    if (isVisible === null) return;
    const next = !isVisible;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: section, isVisible: next }),
      });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setIsVisible(next);
    } catch {
      toast.error("Could not update the section", { position: "top-right", autoClose: 5000, hideProgressBar: true, theme: "dark", transition: Bounce });
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
      <span className="text-sm text-mutedColour">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isVisible === true}
        aria-label={`${label}: ${section}`}
        disabled={isVisible === null || saving}
        onClick={(e) => {
          e.preventDefault();
          toggle();
        }}
        className={`relative h-6 w-11 rounded-full border transition duration-200 disabled:opacity-50 ${
          isVisible ? "bg-accentColour border-accentColour" : "bg-backgroundColour border-borderColour"
        }`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-textColour transition-all duration-200 ${
            isVisible ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}
