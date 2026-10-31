import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminSession } from "@/lib/session";
import { GetInvoice } from "@/lib/query/clients.query";
import InvoiceView from "@/app/components/invoiceView";
import PrintButton from "@/app/portal/contracts/[id]/printButton";

export const dynamic = "force-dynamic";

// The admin copy of an invoice. Bank details are left off: they're in the client's copy.
export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isAdminSession())) redirect(`/admin/login?from=${encodeURIComponent(`/admin/invoices/${id}`)}`);
  const invoice = /^\d+$/.test(id) ? GetInvoice(Number(id)) : null;
  if (!invoice) notFound();

  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <Link href={`/admin/Jobs/${invoice.projectId}`} className="text-sm text-mutedColour hover:text-accentColour">← Back to the job</Link>
        <PrintButton />
      </div>
      <InvoiceView invoice={invoice} bank={null} />
    </>
  );
}
