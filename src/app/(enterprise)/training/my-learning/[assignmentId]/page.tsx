import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LearningContent } from "@/lib/training/learning-types";
import { TrainingContent } from "@/components/training-content";
import { LearningActions } from "@/components/training-learning-actions";
import { TrainingCompletionCheck } from "@/components/training-completion-check";
import "../../training.css";

export const dynamic = "force-dynamic";
export default async function AssignedReader({ params, searchParams }: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) notFound();
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) notFound();
  const { data, error } = await client.rpc("training_assignment_content", { p_assignment: assignmentId });
  if (error || !data || typeof data !== "object") notFound();
  const content = data as LearningContent;
  const pages = content.modules.flatMap((module, mi) => module.pages.map((page, pi) => ({ module, page, mi, pi })));
  const query = await searchParams;
  const requested = Number(query.page ?? (content.assignment.savedModule && content.assignment.savedPage ? pages.findIndex(p => p.mi + 1 === content.assignment.savedModule && p.pi + 1 === content.assignment.savedPage) + 1 : 1));
  const index = Number.isInteger(requested) ? requested - 1 : -1;
  if (index < 0 || index >= pages.length) notFound();
  const selected = pages[index];
  const marked = content.marks.some(mark => mark.module === selected.mi + 1 && mark.page === selected.pi + 1);
  return <main className="training-area training-reader"><Link href="/training/my-learning">← My Learning</Link><header><p className="training-eyebrow">Synthetic learning · Assigned version {content.assignment.versionNumber}</p><h1>{content.assignment.title}</h1><p>{content.assignment.viewedCount} of {content.assignment.pageCount} pages marked viewed · Due {content.assignment.dueOn}</p></header>
    <div className="training-reader-grid"><nav aria-label="Assigned course pages" className="training-outline">{content.modules.map((module, mi) => <div key={mi}><h2>{module.title}</h2>{module.pages.map((page, pi) => { const position = pages.findIndex(p => p.mi === mi && p.pi === pi) + 1; const viewed = content.marks.some(mark => mark.module === mi + 1 && mark.page === pi + 1); return <Link aria-current={position === requested ? "page" : undefined} href={`/training/my-learning/${assignmentId}?page=${position}`} key={pi}>{position}. {page.title}{viewed ? " · viewed" : ""}</Link>; })}</div>)}</nav>
      <article className="training-page"><p className="training-eyebrow">Page {requested} of {pages.length} · {selected.module.title} · Version {content.assignment.versionNumber}</p><h2>{selected.page.title}</h2><TrainingContent blocks={selected.page.blocks} />
        <LearningActions assignmentId={assignmentId} module={selected.mi + 1} page={selected.pi + 1} marked={marked} />
        <nav className="training-page-nav" aria-label="Page navigation">{index > 0 ? <Link href={`/training/my-learning/${assignmentId}?page=${index}`}>← Previous page</Link> : <span />}{index + 1 < pages.length ? <Link href={`/training/my-learning/${assignmentId}?page=${index + 2}`}>Next page →</Link> : <Link href="/training/my-learning">Back to My Learning</Link>}</nav>
        <p className="training-boundary">Page navigation does not save progress. Page markers are factual learning progress, not a course result.</p><Link href={`/training/my-learning/${assignmentId}/assessment`}>Assessment and attempts →</Link><TrainingCompletionCheck assignmentId={assignmentId} /></article></div></main>;
}
