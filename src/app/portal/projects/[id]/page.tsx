import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalClient } from "@/lib/session";
import { GetClientProject, ListContracts, ListHandoverFiles, ListInvoices, ListMilestones, ListPayments, ListUpdates } from "@/lib/query/clients.query";
import { GetSiteSettings } from "@/lib/query/settings.query";
import { cardFee, describeMilestones, handoverReleased, isDeposit, supportEndsOn } from "@/lib/portal";
import { GetBankDetails, hasBankDetails } from "@/lib/bankDetails";
import { stripeReady } from "@/lib/stripe";
import { formatDate, formatDateTime, formatPence, formatPounds, londonDay } from "@/lib/format";
import RichText from "@/lib/richText";
import { MILESTONE_LABELS, PROJECT_LABELS, StatusPill } from "../../components/status";
import PostButton from "../../components/postButton";
import SupportForm from "./supportForm";
import CardPayment from "./cardPayment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Project" };

export default async function PortalProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const client = await requirePortalClient();
  const id = Number((await params).id);
  // Only this client's own projects can be opened
  const project = Number.isInteger(id) ? GetClientProject(id, client.id) : null;
  if (!project) notFound();

  const settings = GetSiteSettings();
  const bank = GetBankDetails();
  const cardAvailable = project.allowCard && stripeReady();
  const justPaid = (await searchParams).paid === "1";
  const handoverFiles = ListHandoverFiles(project.id);
  const hasHandover = handoverFiles.length > 0 || Boolean(project.handoverRepoUrl);
  const milestones = describeMilestones(project, ListMilestones(project.id));
  const invoices = ListInvoices(project.id).filter((invoice) => invoice.status !== "void");
  const released = handoverReleased(milestones);
  const updates = ListUpdates(project.id);
  const contract = ListContracts(project.id).find((c) => c.status !== "void" && c.status !== "draft");
  const due = milestones.filter((m) => m.display === "payment_due" || m.display === "payment_reported");
  const done = milestones.filter((m) => m.display === "complete").length;
  // Card fees are extra to the project price, so they're left out of these sums
  const paid = milestones.filter((m) => m.paidAt).reduce((sum, m) => sum + m.amount, 0);
  const remaining = Math.max(project.totalPrice - paid, 0);
  const nextPayment = milestones.find((m) => m.requiresPayment && !m.paidAt);
  const milestoneInvoice = (milestoneId: number) => invoices.find((invoice) => invoice.milestoneId === milestoneId);
  const hostingInvoices = invoices.filter((invoice) => invoice.kind === "hosting");
  const hostingDue = hostingInvoices.filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + invoice.total, 0);
  const cardFees = ListPayments(project.id).reduce((sum, payment) => sum + payment.fee, 0);
  const supportEnd = supportEndsOn(project);
  const supportActive = supportEnd ? supportEnd >= londonDay(new Date()) : false;
  const [statusLabel, statusColour] = PROJECT_LABELS[project.status];

  return (
    <>
      <Link href="/portal" className="text-sm text-mutedColour hover:text-accentColour">← All projects</Link>
      <header className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm text-mutedColour">{project.reference}</p>
          <h1 className="text-3xl font-FiraSans-ExtraBold">{project.title}</h1>
        </div>
        <StatusPill label={statusLabel} colour={statusColour} />
      </header>

      {justPaid && (
        <p className="mt-6 card p-4 border-successColour/50 text-successColour" role="status">
          Thanks for your payment. It can take a minute to show here; you&apos;ll also get an email once it&apos;s confirmed.
        </p>
      )}

      {/* Contract */}
      <section className="mt-8 card p-6" aria-labelledby="contract-heading">
        <h2 id="contract-heading" className="text-lg font-FiraSans-Bold">Contract</h2>
        {!contract && <p className="mt-2 text-mutedColour">Your contract will appear here when it&apos;s ready. Work starts once it&apos;s signed.</p>}
        {contract?.status === "sent" && (
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-mutedColour">Your contract is ready to review and sign. Work starts once it&apos;s signed.</p>
            <Link href={`/portal/contracts/${contract.id}`} className="btn-primary shrink-0">Review and sign</Link>
          </div>
        )}
        {contract?.status === "signed" && (
          <p className="mt-2 text-mutedColour">
            Signed by {contract.signedName} on {formatDateTime(contract.signedAt!)}.{" "}
            <Link href={`/portal/contracts/${contract.id}`} className="text-accentColour underline underline-offset-4">View the contract</Link>
          </p>
        )}
      </section>

      {/* Costs */}
      {(project.totalPrice > 0 || invoices.length > 0) && (
        <section className="mt-6 card p-6" aria-labelledby="costs-heading">
          <h2 id="costs-heading" className="text-lg font-FiraSans-Bold">Costs</h2>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-borderColour bg-backgroundColour p-4">
              <dt className="text-xs uppercase tracking-wider text-mutedColour">Total</dt>
              <dd className="mt-1 text-2xl font-FiraSans-ExtraBold text-textColour">{formatPence(project.totalPrice)}</dd>
            </div>
            <div className="rounded-lg border border-borderColour bg-backgroundColour p-4">
              <dt className="text-xs uppercase tracking-wider text-mutedColour">Paid so far</dt>
              <dd className="mt-1 text-2xl font-FiraSans-ExtraBold text-successColour">{formatPence(paid)}</dd>
            </div>
            <div className="rounded-lg border border-borderColour bg-backgroundColour p-4">
              <dt className="text-xs uppercase tracking-wider text-mutedColour">Left to pay</dt>
              <dd className="mt-1 text-2xl font-FiraSans-ExtraBold text-textColour">{formatPence(remaining)}</dd>
            </div>
          </dl>
          <div
            className="mt-4 h-2 rounded-full bg-backgroundColour border border-borderColour overflow-hidden"
            role="progressbar"
            aria-label="Amount paid"
            aria-valuemin={0}
            aria-valuemax={project.totalPrice}
            aria-valuenow={paid}
            aria-valuetext={`${formatPence(paid)} of ${formatPence(project.totalPrice)} paid`}
          >
            <div className="h-full bg-successColour" style={{ width: `${project.totalPrice ? Math.min((paid / project.totalPrice) * 100, 100) : 0}%` }} />
          </div>
          {nextPayment && (
            <p className="mt-3 text-sm text-mutedColour">
              Next payment: <span className="text-textColour font-FiraSans-SemiBold">{formatPence(nextPayment.amount)}</span> for &ldquo;{nextPayment.title}&rdquo;,{" "}
              {nextPayment.display === "payment_due" || nextPayment.display === "payment_reported"
                ? "due now"
                : isDeposit(milestones, nextPayment) || project.paymentTiming === "before"
                  ? isDeposit(milestones, nextPayment)
                    ? "due before work starts"
                    : "due before that stage starts"
                  : "due when that stage is delivered"}
              .
            </p>
          )}

          {milestones.length > 0 && (
            <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">Cost of each stage</caption>
              <thead>
                <tr className="border-b border-borderColour text-left text-xs uppercase tracking-wider text-mutedColour">
                  <th scope="col" className="py-2 font-FiraSans-SemiBold">Stage</th>
                  <th scope="col" className="py-2 font-FiraSans-SemiBold text-right">Cost</th>
                  <th scope="col" className="py-2 pl-4 font-FiraSans-SemiBold text-right">Invoice</th>
                  <th scope="col" className="py-2 pl-4 font-FiraSans-SemiBold text-right">Payment</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((milestone, index) => {
                  const status = !milestone.requiresPayment
                    ? ["Included", "text-mutedColour"]
                    : milestone.paidAt
                      ? [`Paid ${formatDate(milestone.paidAt)}`, "text-successColour"]
                      : milestone.display === "payment_reported"
                        ? ["Being confirmed", "text-warningColour"]
                        : milestone.display === "payment_due"
                          ? ["Due now", "text-warningColour"]
                          : ["Not due yet", "text-mutedColour"];
                  return (
                    <tr key={milestone.id} className="border-b border-borderColour last:border-0">
                      <td className="py-2.5 pr-4 text-textColour">{index + 1}. {milestone.title}</td>
                      <td className="py-2.5 text-right text-textColour whitespace-nowrap">{milestone.amount ? formatPence(milestone.amount) : "–"}</td>
                      <td className="py-2.5 pl-4 text-right whitespace-nowrap">
                        {milestoneInvoice(milestone.id) ? (
                          <Link href={`/portal/invoices/${milestoneInvoice(milestone.id)!.id}`} className="font-mono text-accentColour hover:underline">
                            {milestoneInvoice(milestone.id)!.number}
                          </Link>
                        ) : (
                          <span className="text-mutedColour">–</span>
                        )}
                      </td>
                      <td className={`py-2.5 pl-4 text-right whitespace-nowrap ${status[1]}`}>{status[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
          {cardFees > 0 && (
            <p className="mt-3 text-xs text-mutedColour">You also paid {formatPence(cardFees)} in business card fees, which aren&apos;t part of the project price.</p>
          )}

          {(project.hostingMonthly > 0 || hostingInvoices.length > 0) && (
            <div className="mt-6 pt-5 border-t border-borderColour">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-FiraSans-SemiBold">Hosting</h3>
                <p className="text-sm text-mutedColour">
                  {project.hostingMonthly > 0 && `${formatPence(project.hostingMonthly)} a month, billed separately`}
                  {project.hostingPaidUntil && ` · paid up to ${formatDate(project.hostingPaidUntil)}`}
                </p>
              </div>
              {hostingDue > 0 && <p className="mt-1 text-sm text-warningColour">Hosting due now: {formatPence(hostingDue)}</p>}
            </div>
          )}

          {invoices.length > 0 && (
            <div className="mt-6 pt-5 border-t border-borderColour">
              <h3 className="font-FiraSans-SemiBold">Invoices</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Your invoices and when they were paid</caption>
                  <thead>
                    <tr className="border-b border-borderColour text-left text-xs uppercase tracking-wider text-mutedColour">
                      <th scope="col" className="py-2 font-FiraSans-SemiBold">Invoice</th>
                      <th scope="col" className="py-2 font-FiraSans-SemiBold">For</th>
                      <th scope="col" className="py-2 font-FiraSans-SemiBold">Issued</th>
                      <th scope="col" className="py-2 font-FiraSans-SemiBold text-right">Amount</th>
                      <th scope="col" className="py-2 pl-4 font-FiraSans-SemiBold text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-borderColour last:border-0">
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <Link href={`/portal/invoices/${invoice.id}`} className="font-mono text-accentColour hover:underline">{invoice.number}</Link>
                        </td>
                        <td className="py-2.5 pr-3 text-mutedColour">{invoice.data.lines[0]?.description}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-mutedColour">{formatDate(invoice.issuedAt)}</td>
                        <td className="py-2.5 text-right whitespace-nowrap text-textColour">{formatPence(invoice.total)}</td>
                        <td className={`py-2.5 pl-4 text-right whitespace-nowrap ${invoice.status === "paid" ? "text-successColour" : "text-warningColour"}`}>
                          {invoice.status === "paid"
                            ? `${invoice.paidAt ? formatDate(invoice.paidAt) : "Paid"}${invoice.data.paidBy ? ` (${invoice.data.paidBy === "card" ? "card" : "bank"})` : ""}`
                            : `Due ${formatDate(invoice.dueAt)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Payments due */}
      {due.map((milestone) => (
        <section key={milestone.id} className="mt-6 card p-6 border-warningColour/50" aria-labelledby={`due-${milestone.id}`}>
          <h2 id={`due-${milestone.id}`} className="text-lg font-FiraSans-Bold">
            Payment due: {formatPence(milestone.amount)} for &ldquo;{milestone.title}&rdquo;
          </h2>
          {milestone.display === "payment_reported" ? (
            <p className="mt-2 text-mutedColour">Thanks, you told me this was sent on {formatDateTime(milestone.paymentReportedAt!)}. I&apos;ll confirm as soon as it arrives.</p>
          ) : (
            <>
              <p className="mt-2 text-mutedColour">
                Please pay within 14 days{milestone.paymentRequestedAt ? ` of ${formatDate(milestone.paymentRequestedAt)}` : ""}.{" "}
                {project.paymentTiming === "before" ? "This stage starts once payment arrives." : "The next stage starts once payment arrives."}
              </p>
              <h3 className="mt-4 text-sm font-FiraSans-SemiBold">Bank transfer (no fee)</h3>
              {hasBankDetails(bank) ? (
                <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-backgroundColour border border-borderColour p-4">
                  {[
                    ["Account name", bank.bankAccountName],
                    ["Sort code", bank.bankSortCode],
                    ["Account number", bank.bankAccountNumber],
                    ["Reference", milestone.paymentReference],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wider text-mutedColour">{label}</dt>
                      <dd className="mt-1 font-mono text-textColour select-all">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-mutedColour">I&apos;ll email you the bank details. Please use the reference <span className="font-mono text-textColour">{milestone.paymentReference}</span>.</p>
              )}
              <p className="mt-2 text-xs text-mutedColour">
                Please check these details match the ones in your contract emails. I will never ask you to pay into a different account by email.
              </p>
              <div className="mt-4">
                <PostButton url="/api/portal/payment" body={{ milestoneId: milestone.id }} label="I've sent the payment" doneMessage="Thanks! I'll confirm once it arrives." />
              </div>
              {cardAvailable && <CardPayment milestoneId={milestone.id} amount={milestone.amount} businessFee={cardFee(milestone.amount, settings)} />}
            </>
          )}
        </section>
      ))}

      {/* Progress */}
      <section className="mt-6 card p-6" aria-labelledby="progress-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="progress-heading" className="text-lg font-FiraSans-Bold">Progress</h2>
          {milestones.length > 0 && <p className="text-sm text-mutedColour">{done} of {milestones.length} stages complete</p>}
        </div>
        {milestones.length > 0 && (
          <div className="mt-4 h-2 rounded-full bg-backgroundColour border border-borderColour overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={milestones.length} aria-valuenow={done} aria-label="Stages complete">
            <div className="h-full bg-accentColourGR" style={{ width: `${(done / milestones.length) * 100}%` }} />
          </div>
        )}
        {milestones.length === 0 && <p className="mt-2 text-mutedColour">The project stages will appear here once they&apos;re agreed.</p>}
        <ol className="mt-6 relative border-l border-borderColour ml-2">
          {milestones.map((milestone, index) => {
            const [label, colour] = MILESTONE_LABELS[milestone.display];
            return (
              <li key={milestone.id} className="mb-8 last:mb-0 pl-6 relative">
                <span
                  className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-4 ring-secondaryColour ${milestone.display === "complete" ? "bg-successColour" : milestone.display === "in_progress" ? "bg-accentColour" : "bg-borderColour"}`}
                  aria-hidden
                />
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <h3 className="font-FiraSans-Bold">
                    {index + 1}. {milestone.title}
                  </h3>
                  <StatusPill label={label} colour={colour} />
                </div>
                <p className="mt-1 text-sm text-mutedColour">
                  {[
                    milestone.amount ? formatPence(milestone.amount) : null,
                    milestone.requiresPayment
                      ? milestone.paidAt
                        ? `paid ${formatDate(milestone.paidAt)}`
                        : project.paymentTiming === "before"
                          ? "paid before this stage starts"
                          : "paid when delivered, before the next stage"
                      : null,
                    milestone.dueDate ? `target ${formatDate(milestone.dueDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {milestone.description && <RichText text={milestone.description} className="mt-2 space-y-2 text-sm text-mutedColour" headingLevel={4} />}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Updates */}
      {updates.length > 0 && (
        <section className="mt-6 card p-6" aria-labelledby="updates-heading">
          <h2 id="updates-heading" className="text-lg font-FiraSans-Bold">Updates</h2>
          <ul className="mt-4 space-y-5">
            {updates.map((update) => (
              <li key={update.id} className="border-l-2 border-accentColour/40 pl-4">
                <p className="text-xs text-mutedColour">{update.createdAt ? formatDateTime(update.createdAt) : ""}</p>
                <RichText text={update.body} className="mt-1 space-y-2 text-textColour" headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Code handover */}
      {hasHandover && (
        <section className="mt-6 card p-6" aria-labelledby="handover-heading">
          <h2 id="handover-heading" className="text-lg font-FiraSans-Bold">Your code and documents</h2>
          {!released ? (
            <p className="mt-2 text-mutedColour">These become available to download here once the final payment is received.</p>
          ) : (
            <>
              {project.handoverNotes && <RichText text={project.handoverNotes} className="mt-3 space-y-2 text-mutedColour" headingLevel={3} />}
              <ul className="mt-4 flex flex-col gap-2">
                {handoverFiles.map((file) => (
                  <li key={file.id} className="rounded-lg border border-borderColour bg-backgroundColour p-3 text-sm">
                    <a href={`/api/portal/handover/${file.id}`} className="font-FiraSans-Bold text-accentColour hover:underline" download>
                      Download {file.fileName}
                    </a>
                    <span className="text-mutedColour"> · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <p className="mt-1 text-xs text-mutedColour break-all">SHA-256 fingerprint: {file.sha256}</p>
                  </li>
                ))}
                {project.handoverRepoUrl && (
                  <li className="rounded-lg border border-borderColour bg-backgroundColour p-3 text-sm">
                    <a href={project.handoverRepoUrl} target="_blank" rel="noreferrer" className="font-FiraSans-Bold text-accentColour hover:underline">Open the code repository</a>
                  </li>
                )}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Support */}
      <section className="mt-6 card p-6" aria-labelledby="support-heading">
        <h2 id="support-heading" className="text-lg font-FiraSans-Bold">Support and hosting</h2>
        {supportEnd ? (
          <p className="mt-2 text-mutedColour">
            {supportActive ? `Your support runs until ${formatDate(supportEnd)}.` : `Your support ended on ${formatDate(supportEnd)}.`} Found a problem?
            Email <a href={`mailto:${settings.contactEmail}`} className="text-accentColour underline underline-offset-4">{settings.contactEmail}</a>.
          </p>
        ) : (
          <p className="mt-2 text-mutedColour">Includes {project.supportMonths} months of bug fixes and support after launch.</p>
        )}
        {project.hostingMonthly > 0 && (
          <p className="mt-3 text-mutedColour">
            Hosting: {formatPence(project.hostingMonthly)} per month, paid in advance
            {project.hostingPaidUntil ? `. Paid up to ${formatDate(project.hostingPaidUntil)}.` : "."} Please use the reference{" "}
            <span className="font-mono text-textColour">{project.reference}-H</span> when paying.
          </p>
        )}
        {project.status === "completed" && (
          <div className="mt-5">
            <h3 className="font-FiraSans-SemiBold">Extend your support</h3>
            <p className="mt-1 text-sm text-mutedColour">
              Standard: {formatPounds(settings.supportBasicPrice)}/month (up to {settings.supportBasicHours} hours). Priority: {formatPounds(settings.supportPriorityPrice)}/month (up to {settings.supportPriorityHours} hours). Paid in advance by bank transfer.
            </p>
            <SupportForm projectId={project.id} />
          </div>
        )}
      </section>
    </>
  );
}
