export const STATUSES = ["Needs triage", "Investigating", "Visit needed", "Waiting on store", "Monitoring", "Closed"] as const;
export type Issue = {
  id: string; workspace_id: string; store_name: string; store_number: string | null;
  source_region: "north" | "south" | "unassigned"; source_owner: string;
  owner_person_id: string | null; ownerPersonName?: string | null;
  issue_type: string; priority: "Urgent" | "High" | "Review" | "Monitor";
  status: typeof STATUSES[number]; evidence_date: string | null; evidence_summary: string;
  next_action: string; source_note: string | null; potential_internal_theft_review: boolean;
  revision: number; updated_at: string;
  history?: { revision: number; action: string; actorPersonId: string; reason: string | null; occurredAt: string; before: unknown; after: unknown }[];
};
export type Workspace = { id: string; organisationId: string; name: string; status: string; permission: "VIEW" | "OPERATE" | "MANAGE" };
