'use client';

import { usePathname } from "next/navigation";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navigation from "./navigation";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The login page is shown without the admin navigation
  if (pathname === "/admin/login") return <>{children}</>;
  // Previews show the page as visitors will see it, under a banner
  if (pathname?.startsWith("/admin/preview/")) return <>{children}</>;

  return (
    <div className="min-h-screen bg-backgroundColour text-textColour">
      <Navigation />
      <main className="md:ml-64 print:ml-0 px-5 md:px-10 py-8 md:py-10">
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
