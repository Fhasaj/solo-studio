'use client';

import { useEffect, useRef, useState } from "react";
import { SERVICE_ICONS, ServiceIconView } from "@/lib/serviceIcons";

interface IconPickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export default function IconPicker({ id, value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = SERVICE_ICONS[value]?.label ?? "Choose an icon";

  // Close when clicking anywhere outside the picker
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const query = search.trim().toLowerCase();
  const matches = Object.entries(SERVICE_ICONS).filter(
    ([key, icon]) => !query || key.toLowerCase().includes(query) || icon.label.toLowerCase().includes(query) || icon.keywords.includes(query)
  );

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="admin-input flex items-center gap-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accentColour/10 text-xl text-accentColour">
          <ServiceIconView name={value} />
        </span>
        <span className={SERVICE_ICONS[value] ? "text-textColour" : "text-mutedColour"}>{currentLabel}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-borderColour bg-secondaryColour p-3 shadow-xl shadow-black/30">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons, e.g. app, database, payments"
            aria-label="Search icons"
            className="admin-input mb-3"
          />
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-64 overflow-y-auto">
            {matches.map(([key, { label, Icon }]) => (
              <button
                key={key}
                type="button"
                title={label}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                  setSearch("");
                }}
                className={`flex flex-col items-center gap-1 rounded-md p-2 text-center border transition duration-150 ${
                  key === value
                    ? "border-accentColour bg-accentColour/15 text-accentColour"
                    : "border-transparent text-mutedColour hover:border-borderColour hover:text-textColour"
                }`}
              >
                <Icon className="text-2xl" />
                <span className="text-[10px] leading-tight line-clamp-2">{label}</span>
              </button>
            ))}
            {matches.length === 0 && <p className="col-span-full text-sm text-mutedColour">No icons match &ldquo;{search}&rdquo;.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
