import type { Metadata } from "next";
import { canCancel, hashToken } from "@/lib/booking";
import { GetBookingByCancelHash } from "@/lib/query/bookings.query";
import { formatDateTime } from "@/lib/format";
import PublicShell from "../../components/publicShell";
import CancelButton from "./cancelButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cancel your call",
  robots: { index: false, follow: false },
};

export default async function CancelPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const booking = typeof token === "string" && token.length <= 100 ? GetBookingByCancelHash(hashToken(token)) : null;
  const cancellable = booking ? canCancel(booking) : false;

  return (
    <PublicShell>
      <div className="section-container max-w-2xl!">
        <h1 className="text-3xl font-FiraSans-ExtraBold text-textColour">Cancel your call</h1>
        <div className="mt-6 card p-6">
          {!booking && <p className="text-mutedColour">That link isn&apos;t valid. If you need to change a call, just reply to your confirmation email.</p>}
          {booking && !cancellable && (
            <p className="text-mutedColour">
              {booking.status === "cancelled" ? "This call has already been cancelled." : "This call can no longer be cancelled online. Please reply to your confirmation email."}
            </p>
          )}
          {booking && cancellable && (
            <>
              <p className="text-mutedColour">
                Your call is booked for <strong className="text-textColour">{formatDateTime(booking.startsAt)}</strong> (UK time).
              </p>
              <CancelButton token={token!} />
            </>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
