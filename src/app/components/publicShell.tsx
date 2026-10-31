import { GetSectionVisibility, GetSiteSettings } from "@/lib/query/settings.query";
import Navigation from "./navigation";
import Footer from "./footer";

// Navigation, main landmark and footer shared by the public sub-pages
export default function PublicShell({ children }: { children: React.ReactNode }) {
  const settings = GetSiteSettings();
  return (
    <div className="bg-backgroundColour min-h-screen text-textColour cursor-fancy flex flex-col">
      <Navigation sections={GetSectionVisibility()} brand={settings.siteName} />
      <main className="flex-grow">{children}</main>
      <Footer settings={settings} />
    </div>
  );
}
