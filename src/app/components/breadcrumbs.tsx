import Link from "next/link";
import { breadcrumbSchema, JsonLd } from "@/lib/seo";

// Visible breadcrumb trail plus matching BreadcrumbList structured data. The last item is the current page.
export default function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  const trail = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />
      <nav aria-label="Breadcrumb" className="text-sm text-mutedColour">
        <ol className="flex flex-wrap items-center gap-2">
          {trail.map((item, index) => (
            <li key={item.path} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden>/</span>}
              {index === trail.length - 1 ? (
                <span aria-current="page" className="text-textColour">{item.name}</span>
              ) : (
                <Link href={item.path} className="hover:text-accentColour hover:cursor-finger">{item.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
