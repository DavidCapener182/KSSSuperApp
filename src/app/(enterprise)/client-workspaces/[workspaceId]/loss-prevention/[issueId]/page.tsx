import Link from "next/link";
import { readIssue, readWorkspace, workspaceClient } from "@/lib/client-workspaces/server";
import { TfsIssueEditor } from "@/components/tfs-workspace-board";
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{workspaceId:string;issueId:string}>}) {
 const {workspaceId,issueId}=await params; const client=await workspaceClient(); const workspace=await readWorkspace(client,workspaceId);
 const issue=await readIssue(client,workspaceId,issueId);
 return <main className="cw-page"><Link className="cw-back" href={`/client-workspaces/${workspaceId}/loss-prevention`}>← Loss Prevention board</Link><header className="cw-header cw-tfs-header"><div><p className="cw-eyebrow">{workspace.name} · issue detail</p><h1>{issue.store_name}</h1><p>{issue.store_number ? `Store ${issue.store_number} · ` : "Unmatched store · "}{issue.issue_type}</p></div><span className="cw-status">{issue.status}</span></header>
 <div className="cw-detail-layout"><section className="cw-panel"><h2>Evidence and next action</h2><dl className="cw-facts"><div><dt>Priority</dt><dd>{issue.priority}</dd></div><div><dt>Source region</dt><dd>{issue.source_region}</dd></div><div><dt>Owner</dt><dd>{issue.owner_person_id && issue.ownerPersonName ? <Link href={`/people/${issue.owner_person_id}`}>{issue.ownerPersonName} ↗</Link> : <>{issue.source_owner} · not mapped to a KSS Person</>}</dd></div><div><dt>Evidence date</dt><dd>{issue.evidence_date || "Not supplied"}</dd></div></dl><h3>Evidence summary</h3><p>{issue.evidence_summary}</p><h3>Next action</h3><p>{issue.next_action}</p><h3>Source note</h3><p>{issue.source_note || "No source note"}</p>{issue.potential_internal_theft_review && <p className="cw-caution">Potential internal theft review · unproven</p>}</section>
 <aside className="cw-panel"><h2>Issue action</h2>{workspace.permission === "VIEW" ? <p>View access. An operate grant is required to change this issue.</p> : <TfsIssueEditor workspaceId={workspaceId} issue={issue}/>}</aside></div>
 <section className="cw-panel cw-history"><h2>Attributable history</h2><ol>{issue.history?.map(e=><li key={e.revision}><strong>Revision {e.revision} · {e.action.toLowerCase()}</strong><span>{new Date(e.occurredAt).toLocaleString("en-GB")} · Person {e.actorPersonId}</span>{e.reason&&<p>Reason: {e.reason}</p>}</li>)}</ol></section></main>;
}
