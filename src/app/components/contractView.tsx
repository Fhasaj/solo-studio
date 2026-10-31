import type { Contract } from "@/lib/query/clients.query";
import { formatDateTime } from "@/lib/format";
import RichText from "@/lib/richText";

// The contract text and signature record. Shared by the client portal and the admin, and print-friendly.
export default function ContractView({ contract }: { contract: Contract }) {
  return (
    <article className="mt-6 card p-6 md:p-10 print-plain" aria-labelledby="contract-title">
      <h1 id="contract-title" className="text-2xl md:text-3xl font-FiraSans-ExtraBold text-textColour">{contract.title}</h1>
      <RichText text={contract.body} headingLevel={2} className="mt-6 space-y-4 text-mutedColour leading-relaxed" />

      {(contract.sentAt || contract.signedAt) && (
        <section className="mt-10 pt-6 border-t border-borderColour grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm" aria-label="Signatures">
          {contract.sentAt && (
            <div>
              <p className="font-FiraSans-Bold text-textColour">For the Developer</p>
              <p className="mt-1 text-mutedColour">{contract.providerName}</p>
              <p className="text-mutedColour">Issued {formatDateTime(contract.sentAt)}</p>
            </div>
          )}
          <div>
            <p className="font-FiraSans-Bold text-textColour">For the Client</p>
            {contract.signedAt ? (
              <>
                <p className="mt-1 text-mutedColour">Signed electronically by {contract.signedName}</p>
                <p className="text-mutedColour">{formatDateTime(contract.signedAt)}</p>
              </>
            ) : (
              <p className="mt-1 text-mutedColour">Not signed yet</p>
            )}
          </div>
          {contract.bodyHash && (
            <p className="sm:col-span-2 text-xs text-mutedColour break-all">
              Document fingerprint (SHA-256): <span className="font-mono">{contract.bodyHash}</span>
            </p>
          )}
        </section>
      )}
    </article>
  );
}
