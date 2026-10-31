import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminSession } from "@/lib/session";
import { GetCaseStudy, PublishProblems } from "@/lib/query/caseStudies.query";
import { GetContent } from "@/lib/query/content.query";
import CaseStudyView from "@/app/work/caseStudyView";

export const dynamic = "force-dynamic";

// Shows a case study (draft or published) exactly as the public page will, for the admin only
export default async function CaseStudyPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isAdminSession())) redirect(`/admin/login?from=${encodeURIComponent(`/admin/preview/work/${id}`)}`);

  const caseStudy = /^\d+$/.test(id) ? GetCaseStudy(Number(id)) : null;
  if (!caseStudy) notFound();

  // Hidden testimonials are included so you can see how a linked one will look
  const testimonials = GetContent("testimonials", true).filter((t) => t.caseStudyId === String(caseStudy.id));
  const problems = PublishProblems(caseStudy);

  return (
    <div className="bg-backgroundColour min-h-screen text-textColour">
      <div className="sticky top-0 z-30 bg-warningColour text-backgroundColour px-5 py-3 text-sm font-FiraSans-SemiBold flex flex-wrap items-center justify-between gap-3">
        <span>
          Preview · {caseStudy.status === "published" ? "Published" : "Draft: not visible to the public"}
          {problems.length > 0 && ` · Before publishing: ${problems.join(" ")}`}
        </span>
        <Link href={`/admin/CaseStudies/${caseStudy.id}`} className="underline underline-offset-4">Back to editing</Link>
      </div>
      <main>
        <CaseStudyView caseStudy={caseStudy} testimonials={testimonials} />
      </main>
    </div>
  );
}
