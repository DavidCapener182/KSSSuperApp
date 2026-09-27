import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
 const client=await createServerSupabase(); const principal=await getPrincipal(client);
 if(!principal?.roles.includes("SUPER_ADMIN")) return Response.json({error:"Unavailable"},{status:404});
 let body:Record<string,unknown>; try {body=await request.json();} catch {return Response.json({error:"Invalid request"},{status:400});}
 if(!body||typeof body!=="object"||typeof body.reason!=="string"||body.reason.trim().length<10||body.reason.length>500)
  return Response.json({error:"A 10–500 character reason is required"},{status:400});
 let result;
 if(body.action==="create"&&typeof body.organisationId==="string"&&isUuid(body.organisationId))
  result=await client.rpc("cw_create_workspace",{p_organisation:body.organisationId,p_reason:body.reason});
 else if(body.action==="grant"&&typeof body.workspaceId==="string"&&isUuid(body.workspaceId)&&typeof body.personId==="string"&&isUuid(body.personId)&&typeof body.permission==="string")
  result=await client.rpc("cw_grant",{p_workspace:body.workspaceId,p_person:body.personId,p_permission:body.permission,p_reason:body.reason,p_until:null});
 else if(body.action==="revoke"&&typeof body.grantId==="string"&&isUuid(body.grantId))
  result=await client.rpc("cw_revoke",{p_grant:body.grantId,p_reason:body.reason});
 else return Response.json({error:"Invalid request"},{status:400});
 if(result.error) return Response.json({error:"Change was not accepted"},{status:result.error.code==="42501"?404:400});
 const readback=await client.rpc("cw_admin_registry");
 if(readback.error||!readback.data) return Response.json({error:"Changed, but readback unavailable"},{status:503});
 return Response.json({registry:readback.data},{headers:{"Cache-Control":"no-store"}});
}
