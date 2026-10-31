import type { SectionKey } from "@/lib/sections";
import SectionToggle from "./sectionToggle";

interface PageHeaderProps {
  title: string;
  description?: string;
  section?: SectionKey;
}

export default function PageHeader({ title, description, section }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <p className="eyebrow">Admin</p>
        <h1 className="mt-1 text-3xl font-FiraSans-ExtraBold text-textColour">{title}</h1>
        {description && <p className="mt-2 text-mutedColour">{description}</p>}
      </div>
      {section && (
        <div className="card px-4 py-3">
          <SectionToggle section={section} />
        </div>
      )}
    </header>
  );
}
