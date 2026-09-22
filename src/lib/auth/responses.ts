import { NextResponse } from "next/server";

export function privateJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export const unauthorised = () => privateJson({ error: "Unauthorised" }, 401);
export const notFound = () => privateJson({ error: "Not found" }, 404);
export const forbidden = () => privateJson({ error: "Forbidden" }, 403);
