import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MdOutlineFileDownload } from "react-icons/md";
import { getCv } from "@/lib/cv";
import { pageMetadata } from "@/lib/seo";
import PublicShell from "../components/publicShell";
import Breadcrumbs from "../components/breadcrumbs";
import MarkdownView from "../components/markdownView";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cv = getCv();
  if (!cv) return {};
  return pageMetadata({ title: `CV: ${cv.name}`, description: `The CV of ${cv.name}, ${cv.settings.siteDescription}`.slice(0, 160), path: "/cv" });
}

export default function CvPage() {
  const cv = getCv();
  if (!cv) notFound();

  return (
    <PublicShell>
      <div className="section-container max-w-4xl!">
        <div className="no-print flex flex-wrap items-center justify-between gap-4">
          <Breadcrumbs items={[{ name: "CV", path: "/cv" }]} />
          <a href="/cv.pdf" download={cv.fileName} className="btn-primary">
            <MdOutlineFileDownload className="text-xl" aria-hidden />
            Download PDF
          </a>
        </div>
        <article className="mt-8 card p-6 md:p-10 print-plain">
          <MarkdownView blocks={cv.blocks} />
        </article>
      </div>
    </PublicShell>
  );
}
