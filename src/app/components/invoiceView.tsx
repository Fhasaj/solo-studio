import type { Invoice } from "@/lib/query/clients.query";
import type { BankDetails } from "@/lib/bankDetails";
import { formatDate, formatPence } from "@/lib/format";

// A printable invoice. Bank details are the current ones, looked up when it's viewed, and never stored with the invoice.
export default function InvoiceView({ invoice, bank }: { invoice: Invoice; bank: BankDetails | null }) {
  const { data } = invoice;
  return (
    <article className="card p-6 md:p-10 print-plain" aria-labelledby="invoice-title">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        <div>
          <h1 id="invoice-title" className="text-3xl font-FiraSans-ExtraBold text-textColour">Invoice</h1>
          <p className="mt-1 font-mono text-textColour">{invoice.number}</p>
          {invoice.status === "paid" && (
            <p className="mt-2 inline-block rounded-md border border-successColour/40 px-2 py-1 text-sm text-successColour">
              Paid{invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""}
              {data.paidBy ? ` by ${data.paidBy === "card" ? "card" : "bank transfer"}` : ""}
            </p>
          )}
          {invoice.status === "void" && <p className="mt-2 inline-block rounded-md border border-errorColour/40 px-2 py-1 text-sm text-errorColour">Void: not payable</p>}
        </div>
        <div className="text-sm sm:text-right">
          <p className="font-FiraSans-Bold text-textColour">{data.seller.name}</p>
          <p className="whitespace-pre-line text-mutedColour">{data.seller.address}</p>
          <p className="text-mutedColour">{data.seller.email}</p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        {[
          ["Invoice date", formatDate(invoice.issuedAt)],
          ["Supply date", formatDate(data.supplyDate)],
          ["Due by", formatDate(invoice.dueAt)],
          ["Project", data.projectReference],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wider text-mutedColour">{label}</dt>
            <dd className="mt-1 text-textColour">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 text-sm">
        <p className="text-xs uppercase tracking-wider text-mutedColour">Billed to</p>
        <p className="mt-1 font-FiraSans-Bold text-textColour">{data.buyer.company || data.buyer.name}</p>
        {data.buyer.company && <p className="text-mutedColour">{data.buyer.name}</p>}
        <p className="whitespace-pre-line text-mutedColour">{data.buyer.address}</p>
        <p className="text-mutedColour">{data.buyer.email}</p>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-borderColour text-left text-xs uppercase tracking-wider text-mutedColour">
            <th className="py-2 font-FiraSans-SemiBold">Description</th>
            <th className="py-2 text-right font-FiraSans-SemiBold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, index) => (
            <tr key={index} className="border-b border-borderColour">
              <td className="py-3 pr-4 text-textColour">{line.description}</td>
              <td className="py-3 text-right text-textColour">{formatPence(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th className="pt-4 text-left font-FiraSans-Bold text-textColour">Total</th>
            <td className="pt-4 text-right text-lg font-FiraSans-ExtraBold text-textColour">{formatPence(invoice.total)}</td>
          </tr>
        </tfoot>
      </table>

      {invoice.status === "unpaid" && (
        <div className="mt-8 rounded-lg border border-borderColour p-4 text-sm">
          <p className="font-FiraSans-SemiBold text-textColour">How to pay</p>
          {bank ? (
            <p className="mt-1 text-mutedColour">
              Bank transfer to {bank.bankAccountName}, sort code {bank.bankSortCode}, account {bank.bankAccountNumber}, reference{" "}
              <span className="font-mono text-textColour">{data.paymentReference}</span>.
            </p>
          ) : (
            <p className="mt-1 text-mutedColour">Use the reference <span className="font-mono text-textColour">{data.paymentReference}</span>. Bank details are in your client portal.</p>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-mutedColour">{data.notes} Payment due within 14 days of the invoice date.</p>
    </article>
  );
}
