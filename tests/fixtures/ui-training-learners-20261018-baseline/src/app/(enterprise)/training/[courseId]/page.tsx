import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TrainingVersion } from "@/lib/training/types";
import { TrainingContent } from "@/components/training-content";
import "../training.css";

export const dynamic = "force-dynamic";
export default async function CourseReader({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { courseId } = await params;
  if (!isUuid(courseId)) notFound();
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) notFound();
  const { data, error } = await client.rpc("training_catalogue", { p_course: courseId });
  const course = !error && Array.isArray(data) ? data[0] as TrainingVersion | undefined : undefined;
  if (!course) notFound();
  const pages = course.modules.flatMap((module, moduleIndex) => module.pages.map((page, pageIndex) => ({ module, moduleIndex, page, pageIndex })));
  const query = await searchParams;
  const requested = Number(query.page ?? 1);
  const index = Number.isInteger(requested) ? requested - 1 : -1;
  if (index < 0 || index >= pages.length) notFound();
  const selected = pages[index];
  return <main className="training-area training-reader"><Link href="/training">← Course catalogue</Link><header><p className="training-eyebrow">Synthetic example · Version {course.versionNumber}</p><h1>{course.title}</h1><p>{course.summary}</p></header>
    <div className="training-reader-grid"><nav aria-label="Course pages" className="training-outline">{course.modules.map((module, moduleIndex) => <div key={moduleIndex}><h2>{module.title}</h2>{module.pages.map((page, pageIndex) => { const position = pages.findIndex(item => item.moduleIndex === moduleIndex && item.pageIndex === pageIndex) + 1; return <Link aria-current={position === requested ? "page" : undefined} href={`/training/${courseId}?page=${position}`} key={pageIndex}>{position}. {page.title}</Link>; })}</div>)}</nav>
      <article className="training-page"><p className="training-eyebrow">Page {requested} of {pages.length} · {selected.module.title}</p><h2>{selected.page.title}</h2><TrainingContent blocks={selected.page.blocks} /><nav className="training-page-nav" aria-label="Page navigation">{index > 0 ? <Link href={`/training/${courseId}?page=${index}`}>← Previous page</Link> : <span />}{index + 1 < pages.length ? <Link href={`/training/${courseId}?page=${index + 2}`}>Next page →</Link> : <Link href="/training">Back to catalogue</Link>}</nav><p className="training-boundary">Page position is navigation only. No learning result is stored.</p></article></div></main>;
}
