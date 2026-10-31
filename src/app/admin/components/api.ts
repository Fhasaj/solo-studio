'use client';

import { Bounce, toast } from "react-toastify";

export const toastOptions = { position: "top-right", autoClose: 4000, hideProgressBar: true, theme: "dark", transition: Bounce } as const;

export class ApiError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

// JSON request to an admin API. Throws ApiError with the server's message on failure.
export async function api<T = unknown>(url: string, method = "GET", body?: object): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = `/admin/login?from=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiError(json.error ?? `Request failed with status ${res.status}`, json.field);
  return (json.data ?? json) as T;
}

export function showError(error: unknown) {
  toast.error((error as Error).message, toastOptions);
}

export function showSuccess(message: string) {
  toast.success(message, toastOptions);
}
