import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{workspaceId:string}>}) {
 const {workspaceId}=await params; if(!isUuid(workspaceId)) return Response.json({error:"Unavailable"},{status:404});
 const client=await createServerSupabase(); if(!await getPrincipal(client)) return Response.json({error:"Unavailable"},{status:404});
 let body:unknown; try {body=await request.json();} catch {return Response.json({error:"Invalid request"},{status:400});}
 if(!body||typeof body!=="object"||!("data" in body)||!body.data||typeof body.data!=="object"||Array.isArray(body.data)) return Response.json({error:"Invalid request"},{status:400});
 const {data:id,error}=await client.rpc("cw_issue_save",{p_workspace:workspaceId,p_issue:null,p_revision:null,p_data:body.data,p_reason:null});
 if(error||!isUuid(String(id))) return Response.json({error:"Issue was not accepted"},{status:error?.code==="42501"?404:400});
 const readback=await client.rpc("cw_issue",{p_workspace:workspaceId,p_issue:id});
 if(readback.error||!readback.data) return Response.json({error:"Saved but readback unavailable"},{status:503});
 return Response.json({issue:readback.data},{status:201,headers:{"Cache-Control":"no-store"}});
}
