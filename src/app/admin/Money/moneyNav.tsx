'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/Money", label: "Overview" },
  { href: "/admin/Money/Expenses", label: "Expenses, mileage and income" },
  { href: "/admin/Money/Bank", label: "Bank" },
  { href: "/admin/Money/Vat", label: "VAT" },
  { href: "/admin/Money/Rates", label: "Tax rates" },
];

export default function MoneyNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Money" className="mb-6 flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={`rounded-lg border px-4 py-2 text-sm font-FiraSans-SemiBold ${pathname === tab.href ? "border-accentColour bg-accentColour/15 text-accentColour" : "border-borderColour text-mutedColour hover:text-textColour"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

// Every money page carries this: the figures are estimates
export function Disclaimer() {
  return (
    <p className="mt-10 text-xs text-mutedColour max-w-3xl">
      These figures are estimates to help you plan and file, not tax advice. They use the cash basis and don&apos;t cover every relief,
      allowance or situation. Check them with an accountant, and check the tax rates each year under Tax rates.
    </p>
  );
}
