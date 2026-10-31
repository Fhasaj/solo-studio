import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalClient } from "@/lib/session";
import { GetClientProject, GetInvoice } from "@/lib/query/clients.query";
import { GetBankDetails, hasBankDetails } from "@/lib/bankDetails";
import InvoiceView from "@/app/components/invoiceView";
import PrintButton from "../../contracts/[id]/printButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Invoice" };

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const client = await requirePortalClient();
  const id = Number((await params).id);
  const invoice = Number.isInteger(id) ? GetInvoice(id) : null;
  // Only invoices for this client's own projects
  const project = invoice ? GetClientProject(invoice.projectId, client.id) : null;
  if (!invoice || !project) notFound();
  const bank = GetBankDetails();

  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <Link href={`/portal/projects/${project.id}`} className="text-sm text-mutedColour hover:text-accentColour">← Back to {project.title}</Link>
        <PrintButton />
      </div>
      <InvoiceView invoice={invoice} bank={hasBankDetails(bank) ? bank : null} />
    </>
  );
}
