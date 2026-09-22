import { SignInEntry } from "@/components/sign-in-entry";
import { safeReturnTarget } from "@/lib/auth/return-target";

export default async function EntryPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  return <SignInEntry returnTarget={safeReturnTarget(params.next) ?? "/app"} />;
}
