import type { TrainingModule } from "./types";

export type TrainingAssignment = {
  id: string; personId: string; displayName: string; courseId: string; versionId: string;
  versionNumber: number; title: string; assignedAt: string; dueOn: string; reason: string;
  state: "ACTIVE" | "CANCELLED" | "SUPERSEDED"; revision: number; retired: boolean;
  replacesAssignmentId: string | null; replacedByAssignmentId: string | null;
  endedAt: string | null; endReason: string | null; pageCount: number; viewedCount: number;
  savedModule: number | null; savedPage: number | null;
};
export type LearningContent = { assignment: TrainingAssignment; modules: TrainingModule[]; marks: { module: number; page: number }[] };
