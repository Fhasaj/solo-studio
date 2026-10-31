import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preview",
};

export default function previewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
