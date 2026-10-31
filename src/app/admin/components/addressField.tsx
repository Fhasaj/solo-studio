'use client';

import { useEffect, useId, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/addressSearch";
import { TextArea } from "./fields";

interface AddressFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  maxLength?: number;
}

// An address box with a search above it: type a postcode or part of an address, pick a match, then adjust if needed
export default function AddressField({ id, label, value, onChange, help, maxLength = 300 }: AddressFieldProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Searches 300ms after typing stops
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/address-search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const json = await res.json();
        setResults(json.data ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        // aborted or offline: keep the last results
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (suggestion: AddressSuggestion) => {
    onChange(suggestion.address);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div ref={box} className="relative">
        <label htmlFor={`${id}-search`} className="block mb-1 text-sm font-FiraSans-SemiBold text-textColour">{label}: search</label>
        <input
          id={`${id}-search`}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Start typing a postcode or address, e.g. OX1 1AA"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          className="admin-input"
        />
        {open && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-borderColour bg-secondaryColour shadow-xl">
            {loading && results.length === 0 && <li className="px-4 py-3 text-sm text-mutedColour">Searching…</li>}
            {!loading && results.length === 0 && <li className="px-4 py-3 text-sm text-mutedColour">No matches. Type the address below instead.</li>}
            {results.map((result, index) => (
              <li
                key={`${result.address}-${index}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(result);
                }}
                onMouseEnter={() => setActive(index)}
                className={`cursor-pointer px-4 py-2.5 text-sm ${index === active ? "bg-accentColour/15 text-accentColour" : "text-textColour"}`}
              >
                {result.label}
              </li>
            ))}
            {results.length > 0 && (
              <li className="px-4 py-2 text-[11px] text-mutedColour border-t border-borderColour">
                Addresses © OpenStreetMap contributors · postcodes from postcodes.io (ONS/OS open data)
              </li>
            )}
          </ul>
        )}
      </div>
      <TextArea id={id} label={label} rows={4} maxLength={maxLength} value={value} onChange={onChange} help={help ?? "Pick a match above, or type it here. Check the house number and street."} />
    </div>
  );
}
