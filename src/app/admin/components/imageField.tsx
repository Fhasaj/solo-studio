'use client';

import { useRef, useState } from "react";
import Image from "next/image";
import { showError } from "./api";

export interface ImageValue {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface ImageFieldProps {
  id: string;
  label: string;
  value: ImageValue | null;
  onChange: (value: ImageValue | null) => void;
  extraActions?: React.ReactNode;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 8 * 1024 * 1024;

// Uploads an image to /api/admin/upload (resized and converted to WebP there) and asks for its alt text
export default function ImageField({ id, label, value, onChange, extraActions }: ImageFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    // Checked again on the server; this just saves a pointless upload
    if (file.size > MAX_BYTES) return showError(new Error("Images must be 8 MB or smaller."));
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      onChange({ ...json.data, alt: value?.alt ?? "" });
    } catch (error) {
      showError(error);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-borderColour bg-backgroundColour p-4">
      <p className="text-sm font-FiraSans-SemiBold text-textColour">{label}</p>
      {value ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
          <Image src={value.src} alt={value.alt || "Uploaded image"} width={value.width} height={value.height} sizes="160px" className="w-full h-auto rounded-md border border-borderColour" />
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-alt`} className="text-sm text-textColour">
              Alt text <span className="text-errorColour">*</span>
            </label>
            <input
              id={`${id}-alt`}
              value={value.alt}
              maxLength={200}
              placeholder="Describe what the image shows, e.g. Job scheduling screen on a tablet"
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
              className={`admin-input ${value.alt.trim() ? "" : "border-warningColour!"}`}
            />
            <p className="text-xs text-mutedColour">{value.width}×{value.height}px WebP</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="rounded-md border border-borderColour px-3 py-1 text-sm hover:border-accentColour hover:text-accentColour">
                {uploading ? "Uploading…" : "Replace"}
              </button>
              <button type="button" onClick={() => onChange(null)} className="rounded-md border border-errorColour/40 px-3 py-1 text-sm text-errorColour hover:bg-errorColour/10">
                Remove
              </button>
              {extraActions}
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="mt-3 w-full rounded-lg border border-dashed border-borderColour py-6 text-sm text-mutedColour hover:border-accentColour hover:text-accentColour">
          {uploading ? "Uploading…" : "Choose an image (JPEG, PNG, WebP or AVIF, up to 8 MB)"}
        </button>
      )}
      <input ref={input} id={id} type="file" accept={ACCEPT} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}
