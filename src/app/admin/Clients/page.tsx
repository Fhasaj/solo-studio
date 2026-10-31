"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Client } from "@/lib/query/clients.query";
import PageHeader from "../components/pageHeader";
import ClientForm, { EMPTY_CLIENT } from "../components/clientForm";
import { api, showError, showSuccess } from "../components/api";
import { Pill } from "../components/fields";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const load = useCallback(() => api<Client[]>("/api/admin/clients").then(setClients).catch(showError), []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Clients" description="People who can sign in to the client portal. Add them here, or from a booking." />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
        <div className="card p-6">
          <h2 className="mb-4 text-xl font-FiraSans-Bold">Add a client</h2>
          <ClientForm
            initial={EMPTY_CLIENT}
            submitLabel="Add client"
            onSubmit={async (values) => {
              try {
                await api("/api/admin/clients", "POST", values);
                showSuccess("Client added");
                await load();
                return true;
              } catch (error) {
                showError(error);
                return false;
              }
            }}
          />
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-FiraSans-Bold">All clients</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {clients === null && <li className="text-mutedColour">Loading…</li>}
            {clients?.length === 0 && <li className="text-mutedColour">No clients yet.</li>}
            {clients?.map((client) => (
              <li key={client.id} className="rounded-lg border border-borderColour bg-backgroundColour p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/Clients/${client.id}`} className="font-FiraSans-Bold hover:text-accentColour">{client.name}</Link>
                  <p className="text-sm text-mutedColour truncate">{[client.company, client.email].filter(Boolean).join(" · ")}</p>
                </div>
                {!client.isActive && <Pill tone="grey">No access</Pill>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
