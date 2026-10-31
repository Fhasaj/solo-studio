import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Industries",
};

export default function IndustriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
