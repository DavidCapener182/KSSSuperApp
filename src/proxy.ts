import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Overwrite any caller-provided value: protected layouts use only this
  // same-origin path when returning a signed-out user through sign-in.
  requestHeaders.set("x-kss-return-target", request.nextUrl.pathname + request.nextUrl.search);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          for (const item of items) request.cookies.set(item.name, item.value);
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const item of items) response.cookies.set(item.name, item.value, item.options);
        },
      },
    },
  );
  await client.auth.getClaims();
  if (["/app", "/sites", "/profile", "/documents"].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/documents/")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
