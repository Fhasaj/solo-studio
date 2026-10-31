import type { Metadata } from "next";
import "../globals.css";
import AdminShell from "./components/adminShell";

// Everything under /admin is kept out of search engines; child layouts inherit this
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
