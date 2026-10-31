import Link from "next/link";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import { MdOutlineEmail } from "react-icons/md";
import type { SiteSettings } from "@/lib/siteSettings";

const links = [
  { href: "/work", label: "Case studies" },
  { href: "/#faq", label: "FAQ" },
  { href: "/book", label: "Book a call" },
  { href: "/portal/login", label: "Client login" },
  { href: "/privacy", label: "Privacy" },
];

export default function Footer({ settings }: { settings: SiteSettings }) {
  const socials = [
    settings.githubUrl && { href: settings.githubUrl, label: "GitHub", icon: <FaGithub /> },
    settings.linkedinUrl && { href: settings.linkedinUrl, label: "LinkedIn", icon: <FaLinkedin /> },
    settings.contactEmail && { href: `mailto:${settings.contactEmail}`, label: "Email", icon: <MdOutlineEmail /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <footer className="w-full border-t border-borderColour bg-backgroundColour">
      <div className="w-full max-w-6xl mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <p className="text-sm text-mutedColour">
            &copy; {new Date().getFullYear()} {settings.siteName} · {settings.town}
          </p>
          <nav aria-label="Footer" className="mt-3">
            <ul className="flex flex-wrap justify-center md:justify-start gap-x-5 gap-y-2 text-sm">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-mutedColour hover:text-accentColour hover:cursor-finger">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex items-center gap-5 text-2xl">
          {socials.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target={social.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer"
              aria-label={social.label}
              className="text-mutedColour hover:text-accentColour hover:cursor-finger transition duration-300"
            >
              {social.icon}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
