import type { Metadata } from "next";
import MoneyNav from "./moneyNav";

export const metadata: Metadata = {
  title: "Money",
};

export default function MoneyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MoneyNav />
      {children}
    </>
  );
}
