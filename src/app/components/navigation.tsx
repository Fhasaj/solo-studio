'use client';

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
import type { SectionKey, SectionVisibility } from "@/lib/sections";

const allLinks: { href: string; label: string; section?: SectionKey }[] = [
  { href: "/#services", label: "Services", section: "services" },
  { href: "/work", label: "Work", section: "work" },
  { href: "/#pricing", label: "Pricing", section: "pricing" },
  { href: "/#about", label: "About" },
  { href: "/#contact-me", label: "Contact" },
];

interface NavigationProps {
  sections: SectionVisibility;
  brand: string;
}

export default function Navigation({ sections, brand }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const links = allLinks.filter((link) => !link.section || sections[link.section]);
  const toggleMenu = () => { setIsOpen(!isOpen); }

  return (
    <header className="sticky top-0 z-30 w-full bg-backgroundColour/85 backdrop-blur border-b border-borderColour">
      <nav className="w-full max-w-6xl mx-auto flex items-center justify-between px-5 md:px-8 py-4">
        <Link href="/" className="flex items-center gap-3 hover:cursor-finger">
          <Image
            src="/images/logo.png"
            alt=""
            width={40}
            height={40}
            sizes="40px"
            style={{ height: "auto" }}
          />
          <span className="text-lg md:text-xl font-FiraSans-Bold text-textColour">
            {brand}
          </span>
        </Link>

        <ul className="hidden md:flex items-center gap-7 font-FiraSans-Medium">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-mutedColour hover:text-accentColour hover:cursor-finger transition duration-300 ease-in-out">
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/book" className="btn-primary py-2!">
              Book a call
            </Link>
          </li>
        </ul>

        <button
          type="button"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          className="md:hidden text-3xl text-textColour"
          onClick={toggleMenu}
        >
          {isOpen ? <IoClose /> : <RxHamburgerMenu />}
        </button>
      </nav>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-borderColour bg-backgroundColour">
          <ul className="flex flex-col items-center gap-6 py-8 text-xl font-FiraSans-Medium">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-textColour hover:text-accentColour" onClick={toggleMenu}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/book" className="btn-primary" onClick={toggleMenu}>
                Book a free call
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
