import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TrainingAssessmentClient, type AssessmentStaff } from "@/components/training-assessment-client";
import "../../../training.css";

export const dynamic = "force-dynamic";
export default async function AssignedAssessment({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) notFound();
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) notFound();
  const { data, error } = await client.rpc("training_assessment_staff", { p_assignment: assignmentId });
  if (error || !data || typeof data !== "object") notFound();
  return <main className="training-area"><Link href={`/training/my-learning/${assignmentId}`}>← Assigned course</Link><header><p className="training-eyebrow">Synthetic learning · Exact version assessment</p><h1>Assessment and attempts</h1><p>Opening this page does not start an attempt.</p></header><TrainingAssessmentClient initial={data as AssessmentStaff} /></main>;
}
