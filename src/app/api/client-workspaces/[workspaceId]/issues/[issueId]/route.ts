import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function PATCH(request:Request,{params}:{params:Promise<{workspaceId:string;issueId:string}>}) {
 const {workspaceId,issueId}=await params; if(!isUuid(workspaceId)||!isUuid(issueId)) return Response.json({error:"Unavailable"},{status:404});
 const client=await createServerSupabase(); if(!await getPrincipal(client)) return Response.json({error:"Unavailable"},{status:404});
 let body:unknown; try {body=await request.json();} catch {return Response.json({error:"Invalid request"},{status:400});}
 if(!body||typeof body!=="object"||!("data" in body)||!body.data||typeof body.data!=="object"||Array.isArray(body.data)
  ||!("revision" in body)||!Number.isInteger(body.revision)||!("reason" in body)||typeof body.reason!=="string") return Response.json({error:"Invalid request"},{status:400});
 const {data:id,error}=await client.rpc("cw_issue_save",{p_workspace:workspaceId,p_issue:issueId,p_revision:body.revision,p_data:body.data,p_reason:body.reason});
 const stale = error?.code === "P0001" && error.message === "Issue changed; reload";
 if(error||id!==issueId) return Response.json({error:stale?"Issue changed. Reload before saving.":"Issue was not accepted"},{status:stale?409:error?.code==="42501"?404:400});
 const readback=await client.rpc("cw_issue",{p_workspace:workspaceId,p_issue:issueId});
 if(readback.error||!readback.data) return Response.json({error:"Saved but readback unavailable"},{status:503});
 return Response.json({issue:readback.data},{headers:{"Cache-Control":"no-store"}});
}
