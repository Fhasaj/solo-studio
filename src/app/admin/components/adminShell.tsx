'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MdLogout, MdMenu, MdOpenInNew, MdOutlineManageAccounts, MdOutlineSettings, MdSearch } from "react-icons/md";
import Navigation from "./navigation";
import CommandPalette from "./commandPalette";

interface Me {
  ownerName: string;
  siteName: string;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/admin/login" || Boolean(pathname?.startsWith("/admin/preview/"));
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bare) return;
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((json) => json.data && setMe({ ownerName: json.data.ownerName, siteName: json.data.siteName }))
      .catch(() => {});
  }, [bare]);

  // Ctrl+K / ⌘K anywhere, or "/" when not typing, opens search
  useEffect(() => {
    if (bare) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bare]);

  useEffect(() => {
    if (!accountOpen) return;
    const close = (e: MouseEvent) => accountRef.current && !accountRef.current.contains(e.target as Node) && setAccountOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [accountOpen]);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  if (bare) return <>{children}</>;

  const initials = (me?.ownerName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-backgroundColour text-textColour">
      <Navigation open={menuOpen} onClose={() => setMenuOpen(false)} brand={me?.siteName ?? "Admin"} />
      <div className="md:pl-64 print:pl-0">
        <header className="no-print sticky top-0 z-20 h-16 border-b border-borderColour bg-backgroundColour/85 backdrop-blur flex items-center gap-3 px-4 md:px-8">
          <button type="button" className="md:hidden text-2xl text-textColour" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <MdMenu />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 max-w-xl items-center gap-3 rounded-lg border border-borderColour bg-secondaryColour px-3 py-2 text-sm text-mutedColour hover:border-accentColour/60"
          >
            <MdSearch className="text-lg" aria-hidden />
            <span className="flex-1 text-left">Search everything…</span>
            <kbd className="hidden sm:block rounded border border-borderColour px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank" className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-mutedColour hover:text-textColour">
              View site <MdOpenInNew aria-hidden />
            </Link>
            <div ref={accountRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label="Account menu"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accentColourGR text-sm font-FiraSans-Bold text-backgroundColour"
              >
                {initials || "A"}
              </button>
              {accountOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-borderColour bg-secondaryColour shadow-2xl">
                  <p className="px-4 py-3 border-b border-borderColour text-sm">
                    <span className="block font-FiraSans-SemiBold text-textColour truncate">{me?.ownerName}</span>
                    <span className="block text-xs text-mutedColour truncate">{me?.siteName}</span>
                  </p>
                  <Link role="menuitem" href="/admin/Account" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-backgroundColour">
                    <MdOutlineManageAccounts /> Account and security
                  </Link>
                  <Link role="menuitem" href="/admin/Settings" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-backgroundColour">
                    <MdOutlineSettings /> Site settings
                  </Link>
                  <button role="menuitem" type="button" onClick={logout} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-errorColour hover:bg-backgroundColour">
                    <MdLogout /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="px-4 md:px-8 py-8 max-w-[1600px]">{children}</main>
      </div>
      <CommandPalette open={searchOpen} onClose={closeSearch} />
      <ToastContainer />
    </div>
  );
}
