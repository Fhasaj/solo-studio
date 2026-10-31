'use client';

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MdOutlineDashboard,
  MdOutlineRateReview,
  MdOutlineDesignServices,
  MdOutlineFolder,
  MdOutlineWork,
  MdOutlineCalendarMonth,
  MdOutlinePeople,
  MdOutlineSettings,
  MdOutlineFactory,
  MdOutlineQuiz,
  MdOutlineAccountBalance,
  MdOutlineManageAccounts,
} from "react-icons/md";

export const NAV_GROUPS = [
  {
    label: "Work",
    links: [
      { href: "/admin", label: "Dashboard", icon: MdOutlineDashboard },
      { href: "/admin/Bookings", label: "Bookings", icon: MdOutlineCalendarMonth },
      { href: "/admin/Clients", label: "Clients", icon: MdOutlinePeople },
      { href: "/admin/Jobs", label: "Jobs", icon: MdOutlineWork },
      { href: "/admin/Money", label: "Money", icon: MdOutlineAccountBalance },
    ],
  },
  {
    label: "Website",
    links: [
      { href: "/admin/CaseStudies", label: "Case studies", icon: MdOutlineFolder },
      { href: "/admin/Services", label: "Services", icon: MdOutlineDesignServices },
      { href: "/admin/Industries", label: "Industries", icon: MdOutlineFactory },
      { href: "/admin/Testimonals", label: "Testimonials", icon: MdOutlineRateReview },
      { href: "/admin/Faqs", label: "FAQs", icon: MdOutlineQuiz },
    ],
  },
  {
    label: "Settings",
    links: [
      { href: "/admin/Settings", label: "Site settings", icon: MdOutlineSettings },
      { href: "/admin/Account", label: "Account", icon: MdOutlineManageAccounts },
    ],
  },
];

export function isActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/admin" && Boolean(pathname?.startsWith(`${href}/`)));
}

// The sidebar: always visible on wide screens, a slide-in drawer on phones
export default function Navigation({ open, onClose, brand }: { open: boolean; onClose: () => void; brand: string }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-secondaryColour border-r border-borderColour flex flex-col transition-transform duration-200 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Admin"
      >
        <Link href="/admin" className="flex items-center gap-3 px-5 h-16 border-b border-borderColour shrink-0" onClick={onClose}>
          <Image src="/images/logo.png" alt="" width={30} height={30} style={{ height: "auto" }} />
          <span className="min-w-0">
            <span className="block truncate font-FiraSans-Bold text-textColour leading-tight">{brand}</span>
            <span className="block text-xs text-mutedColour leading-tight">Admin</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 mb-1.5 text-[11px] uppercase tracking-[0.15em] text-mutedColour/80 font-FiraSans-SemiBold">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {group.links.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-FiraSans-Medium transition ${
                          active ? "bg-accentColour/15 text-accentColour" : "text-mutedColour hover:bg-backgroundColour hover:text-textColour"
                        }`}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accentColour" aria-hidden />}
                        <Icon className="text-lg shrink-0" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
