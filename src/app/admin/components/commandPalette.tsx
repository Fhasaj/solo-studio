'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MdSearch } from "react-icons/md";
import type { SearchResult } from "@/lib/search";

// Search across the whole admin. Opens with Ctrl+K / ⌘K or "/", and is fully usable from the keyboard.
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    setQuery("");
    setResults([]);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const json = await res.json();
        setResults(json.data ?? []);
        setActive(0);
      } catch {
        // aborted
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, (SearchResult & { index: number })[]>();
    results.forEach((result, index) => map.set(result.group, [...(map.get(result.group) ?? []), { ...result, index }]));
    return [...map.entries()];
  }, [results]);

  const go = (result: SearchResult) => {
    close();
    router.push(result.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  if (!open) return null;
  const showResults = query.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-borderColour bg-secondaryColour shadow-2xl" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-borderColour px-4">
          <MdSearch className="text-xl text-mutedColour" aria-hidden />
          <input
            ref={input}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `search-result-${active}` : undefined}
            placeholder="Search clients, jobs, invoices, bookings, content, expenses, settings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent py-4 text-textColour placeholder:text-mutedColour focus:outline-none"
          />
          <kbd className="hidden sm:block rounded border border-borderColour px-1.5 py-0.5 text-[10px] text-mutedColour">Esc</kbd>
        </div>
        <div id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
          {!showResults && <p className="px-4 py-6 text-center text-sm text-mutedColour">Type at least two letters.</p>}
          {showResults && !loading && results.length === 0 && <p className="px-4 py-6 text-center text-sm text-mutedColour">Nothing found for &ldquo;{query}&rdquo;.</p>}
          {groups.map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-[0.15em] text-mutedColour">{group}</p>
              {items.map((item) => (
                <button
                  key={`${item.href}-${item.index}`}
                  id={`search-result-${item.index}`}
                  role="option"
                  aria-selected={item.index === active}
                  type="button"
                  onMouseEnter={() => setActive(item.index)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left ${item.index === active ? "bg-accentColour/15" : ""}`}
                >
                  <span className={`truncate ${item.index === active ? "text-accentColour" : "text-textColour"}`}>{item.title}</span>
                  <span className="shrink-0 truncate text-xs text-mutedColour max-w-[45%]">{item.detail}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-4 border-t border-borderColour px-4 py-2 text-[11px] text-mutedColour">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
