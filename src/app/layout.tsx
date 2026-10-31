import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GetSiteSettings } from "@/lib/query/settings.query";
import { SITE_URL } from "@/lib/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

// Built per request from Settings → Your details, so a new site needs no code changes
export function generateMetadata(): Metadata {
  const settings = GetSiteSettings();
  const title = `${settings.siteTitle} | ${settings.siteName}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${settings.siteName}` },
    description: settings.siteDescription,
    authors: [{ name: settings.ownerName, url: SITE_URL }],
    creator: settings.ownerName,
    publisher: settings.siteName,
    openGraph: {
      title,
      description: settings.siteDescription,
      url: "/",
      siteName: settings.siteName,
      images: [DEFAULT_OG_IMAGE],
      locale: "en_GB",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description: settings.siteDescription, images: [DEFAULT_OG_IMAGE.url] },
    alternates: { canonical: "/" },
  };
}

export const viewport: Viewport = {
  themeColor: "#1a1e25",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className="scroll-smooth">
      <body className={` antialiased`}>
        {children}
      </body>
    </html>
  );
}
