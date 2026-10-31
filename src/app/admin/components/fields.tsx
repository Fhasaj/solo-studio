'use client';

interface BaseProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  // Shows a character counter that turns amber past this length
  counter?: number;
}

function Label({ id, label, required, value, counter }: Pick<BaseProps, "id" | "label" | "required" | "value" | "counter">) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-3">
      <label htmlFor={id} className="text-sm font-FiraSans-SemiBold text-textColour">
        {label}
        {required && <span className="text-errorColour"> *</span>}
      </label>
      {counter && (
        <span className={`text-xs ${value.length > counter ? "text-warningColour" : "text-mutedColour"}`}>
          {value.length}/{counter}
        </span>
      )}
    </div>
  );
}

export function TextField({ type = "text", ...props }: BaseProps & { type?: string }) {
  return (
    <div>
      <Label {...props} />
      <input
        id={props.id}
        type={type}
        value={props.value}
        required={props.required}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="admin-input"
      />
      {props.help && <p className="mt-1 text-xs text-mutedColour">{props.help}</p>}
    </div>
  );
}

export function TextArea({ rows = 4, className = "", ...props }: BaseProps & { rows?: number; className?: string }) {
  return (
    <div>
      <Label {...props} />
      <textarea
        id={props.id}
        rows={rows}
        value={props.value}
        required={props.required}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className={`admin-input ${className}`}
      />
      {props.help && <p className="mt-1 text-xs text-mutedColour">{props.help}</p>}
    </div>
  );
}

export function Checkbox({ id, label, checked, onChange, help }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void; help?: string }) {
  return (
    <div>
      <label htmlFor={id} className="inline-flex items-center gap-3 text-sm font-FiraSans-SemiBold text-textColour cursor-pointer">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-accentColour" />
        {label}
      </label>
      {help && <p className="mt-1 ml-7 text-xs text-mutedColour">{help}</p>}
    </div>
  );
}

export const smallButton = "rounded-md border border-borderColour px-3 py-1 text-sm hover:border-accentColour hover:text-accentColour disabled:opacity-40";
export const dangerButton = "rounded-md border border-errorColour/40 px-3 py-1 text-sm text-errorColour hover:bg-errorColour/10 disabled:opacity-40";

const PILL_TONES = {
  green: "bg-successColour/10 text-successColour border-successColour/30",
  blue: "bg-accentColour/10 text-accentColour border-accentColour/30",
  amber: "bg-warningColour/10 text-warningColour border-warningColour/30",
  grey: "bg-backgroundColour text-mutedColour border-borderColour",
  red: "bg-errorColour/10 text-errorColour border-errorColour/30",
};

export function Pill({ children, tone = "grey" }: { children: React.ReactNode; tone?: keyof typeof PILL_TONES }) {
  return <span className={`inline-block shrink-0 text-xs px-2 py-1 rounded-md border ${PILL_TONES[tone]}`}>{children}</span>;
}
