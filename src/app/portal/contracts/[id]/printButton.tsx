"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-md border border-borderColour px-3 py-1.5 text-sm hover:border-accentColour hover:text-accentColour">
      Print or save as PDF
    </button>
  );
}
