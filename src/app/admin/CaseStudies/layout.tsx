import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Case studies",
};

export default function CaseStudiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
