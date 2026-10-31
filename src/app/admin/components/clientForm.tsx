'use client';

import { useState } from "react";
import type { Client } from "@/lib/query/clients.query";
import { Checkbox, TextArea, TextField } from "./fields";
import AddressField from "./addressField";
import { CLIENT_COUNTRIES } from "@/lib/vat";

export type ClientValues = Pick<Client, "name" | "email" | "company" | "phone" | "address" | "country" | "vatNumber" | "notes" | "isActive">;

export const EMPTY_CLIENT: ClientValues = { name: "", email: "", company: "", phone: "", address: "", country: "", vatNumber: "", notes: "", isActive: true };

export default function ClientForm({ initial, submitLabel, onSubmit }: { initial: ClientValues; submitLabel: string; onSubmit: (values: ClientValues) => Promise<boolean> }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ClientValues>(key: K, value: ClientValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const ok = await onSubmit(values);
        setSaving(false);
        if (ok && initial === EMPTY_CLIENT) setValues(EMPTY_CLIENT);
      }}
      className="flex flex-col gap-4"
    >
      <TextField id="client-name" label="Name" required maxLength={120} value={values.name} onChange={(v) => set("name", v)} />
      <TextField id="client-email" label="Email" type="email" required maxLength={254} value={values.email} onChange={(v) => set("email", v)} help="They sign in to the portal with this address." />
      <TextField id="client-company" label="Company" maxLength={150} value={values.company} onChange={(v) => set("company", v)} />
      <TextField id="client-phone" label="Phone" maxLength={30} value={values.phone} onChange={(v) => set("phone", v)} />
      <AddressField id="client-address" label="Billing address" value={values.address} onChange={(v) => set("address", v)} help="Printed on invoices. Pick a match above or type it." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="client-country" className="block mb-1 text-sm font-FiraSans-SemiBold">Country</label>
          <select id="client-country" value={values.country} onChange={(e) => set("country", e.target.value)} className="admin-input">
            <option value="">Same as mine</option>
            {CLIENT_COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <TextField id="client-vat" label="Their VAT number (optional)" maxLength={20} value={values.vatNumber} onChange={(v) => set("vatNumber", v)} help="Decides reverse charge for EU business clients." />
      </div>
      <TextArea id="client-notes" label="Private notes" rows={3} maxLength={5000} value={values.notes} onChange={(v) => set("notes", v)} help="Only you see these." />
      <Checkbox id="client-active" label="Portal access" checked={values.isActive} onChange={(v) => set("isActive", v)} help="Switch off to sign them out and block sign-in." />
      <div>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
