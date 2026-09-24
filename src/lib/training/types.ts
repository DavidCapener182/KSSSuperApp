export type TrainingBlock = { type: "heading" | "paragraph" | "bullet" | "numbered" | "emphasis" | "callout"; text: string };
export type TrainingPage = { title: string; blocks: TrainingBlock[] };
export type TrainingModule = { title: string; pages: TrainingPage[] };
export type TrainingVersion = {
  courseId: string; versionId: string; versionNumber: number; title: string; summary: string;
  audienceRule: string; synthetic: boolean; modules: TrainingModule[];
  courseTitle?: string; courseSummary?: string; state?: string; revision?: number; currentVersionId?: string | null; contentHash?: string | null;
  publishedAt?: string | null; retiredAt?: string | null; abandonedAt?: string | null;
};
