import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ControlRoomClient } from "@/components/control-room-client";

export const dynamic = "force-dynamic";
export default async function ControlRoomPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fcontrol-room");
  if (!principal.roles.some((role) => ["OPERATIONS", "OFFICE_ADMIN", "SUPER_ADMIN"].includes(role))) notFound();
  return <ControlRoomClient />;
}
