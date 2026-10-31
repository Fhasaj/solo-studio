'use client';

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MdOutlineDashboard, MdOutlineRateReview, MdOutlineDesignServices, MdOutlineFolder, MdOutlineWork, MdOutlineHome, MdOutlineLogout, MdOutlineCalendarMonth, MdOutlinePeople, MdOutlineSettings, MdOutlineFactory, MdOutlineQuiz, MdOutlineAccountBalance } from "react-icons/md";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";

const links = [
  { href: "/admin", label: "Dashboard", icon: MdOutlineDashboard },
  { href: "/admin/Bookings", label: "Bookings", icon: MdOutlineCalendarMonth },
  { href: "/admin/Clients", label: "Clients", icon: MdOutlinePeople },
  { href: "/admin/Jobs", label: "Jobs", icon: MdOutlineWork },
  { href: "/admin/Money", label: "Money", icon: MdOutlineAccountBalance },
  { href: "/admin/CaseStudies", label: "Case studies", icon: MdOutlineFolder },
  { href: "/admin/Services", label: "Services", icon: MdOutlineDesignServices },
  { href: "/admin/Industries", label: "Industries", icon: MdOutlineFactory },
  { href: "/admin/Testimonals", label: "Testimonials", icon: MdOutlineRateReview },
  { href: "/admin/Faqs", label: "FAQs", icon: MdOutlineQuiz },
  { href: "/admin/Settings", label: "Settings", icon: MdOutlineSettings },
];

export default function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const linkClass = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 font-FiraSans-Medium transition duration-200 ${
      pathname === href || (href !== "/admin" && href !== "/" && pathname?.startsWith(`${href}/`))
        ? "bg-accentColour/15 text-accentColour"
        : "text-mutedColour hover:bg-backgroundColour hover:text-textColour"
    }`;

  return (
    <aside className="no-print md:fixed md:inset-y-0 md:left-0 md:w-64 w-full bg-secondaryColour border-b md:border-b-0 md:border-r border-borderColour z-30">
      <div className="flex items-center justify-between px-5 py-4 md:py-6">
        <Link href="/admin" className="flex items-center gap-3">
          <Image src="/images/logo.png" alt="" width={32} height={32} style={{ height: "auto" }} />
          <span className="text-lg font-FiraSans-Bold text-textColour">Admin</span>
        </Link>
        <button
          type="button"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          className="md:hidden text-2xl text-textColour"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <IoClose /> : <RxHamburgerMenu />}
        </button>
      </div>

      <nav className={`${isOpen ? "flex" : "hidden"} md:flex flex-col justify-between px-3 pb-4 md:h-[calc(100%-88px)]`}>
        <ul className="flex flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className={linkClass(href)} onClick={() => setIsOpen(false)}>
                <Icon className="text-xl" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-1 mt-6 pt-4 border-t border-borderColour">
          <li>
            <Link href="/" className={linkClass("/")}>
              <MdOutlineHome className="text-xl" />
              View site
            </Link>
          </li>
          <li>
            <button type="button" onClick={logout} className={`${linkClass("")} w-full`}>
              <MdOutlineLogout className="text-xl" />
              Log out
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
