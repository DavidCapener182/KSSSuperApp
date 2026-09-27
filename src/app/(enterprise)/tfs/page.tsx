import { notFound, redirect } from "next/navigation";
import { workspaceClient } from "@/lib/client-workspaces/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const client = await workspaceClient();
  const { data, error } = await client.rpc("cw_tfs_entry");
  if (error || typeof data !== "string") notFound();
  redirect(`/client-workspaces/${data}/loss-prevention`);
}
