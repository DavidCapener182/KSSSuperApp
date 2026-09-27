import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ControlRoomClient } from "@/components/control-room-client";

export const dynamic = "force-dynamic";
export default async function ControlRoomPage({searchParams}:{searchParams:Promise<{source?:string;site?:string;offset?:string;tab?:string;focus?:string}>}) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fcontrol-room");
  if (!principal.roles.some((role) => ["OPERATIONS", "OFFICE_ADMIN", "SUPER_ADMIN"].includes(role))) notFound();
  const q=await searchParams;
  const tabs=["attention","staffing","attendance","incidents","handover","operations"] as const;
  const offset=Number(q.offset??0);
  const focus=q.focus&&/^(EVENT|SITE_SHIFT):[0-9a-f-]{36}:(?:\d{4}-\d{2}-\d{2})?$/i.test(q.focus)?q.focus:undefined;
  return <ControlRoomClient initial={{source:q.source==="EVENT"||q.source==="SITE_SHIFT"?q.source:undefined,site:q.site&&isUuid(q.site)?q.site:undefined,
    offset:Number.isInteger(offset)&&offset>=0&&offset<=1000?offset:0,tab:tabs.find(item=>item===q.tab)??"attention",focus}} />;
}
