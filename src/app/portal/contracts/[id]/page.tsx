import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalClient } from "@/lib/session";
import { GetClientProject, GetContract } from "@/lib/query/clients.query";
import { formatDateTime } from "@/lib/format";
import ContractView from "@/app/components/contractView";
import SignForm from "./signForm";
import PrintButton from "./printButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Contract" };

export default async function PortalContractPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await requirePortalClient();
  const id = Number((await params).id);
  const contract = Number.isInteger(id) ? GetContract(id) : null;
  // Drafts aren't shown to clients, and only their own projects' contracts can be opened
  const project = contract && contract.status !== "draft" ? GetClientProject(contract.projectId, client.id) : null;
  if (!contract || !project) notFound();

  return (
    <>
      <div className="no-print flex items-center justify-between gap-4">
        <Link href={`/portal/projects/${project.id}`} className="text-sm text-mutedColour hover:text-accentColour">← Back to {project.title}</Link>
        <PrintButton />
      </div>

      {contract.status === "void" && (
        <p className="mt-6 card p-4 border-errorColour/50 text-errorColour">This contract has been withdrawn and no longer applies.</p>
      )}

      <ContractView contract={contract} />

      {contract.status === "sent" && (
        <section className="mt-8 card p-6 no-print" aria-labelledby="sign-heading">
          <h2 id="sign-heading" className="text-xl font-FiraSans-Bold">Sign this contract</h2>
          <p className="mt-2 text-sm text-mutedColour">
            Typing your name and pressing sign has the same legal effect as signing on paper. A copy will be emailed to you.
            If anything needs changing, please reply to my email before signing.
          </p>
          <SignForm contractId={contract.id} bodyHash={contract.bodyHash!} defaultName={client.name} />
        </section>
      )}

      {contract.status === "signed" && (
        <p className="mt-6 text-sm text-mutedColour no-print">
          Signed on {formatDateTime(contract.signedAt!)}. A copy was emailed to you; use Print to save it as a PDF.
        </p>
      )}
    </>
  );
}
