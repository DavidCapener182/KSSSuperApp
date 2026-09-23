// A Vercel build must never silently become an unlabelled, indexable deployment.
if (process.env.VERCEL !== "1") process.exit(0);

if (process.env.NEXT_PUBLIC_KSS_STAGE !== "staging") {
  throw new Error("Vercel build blocked: NEXT_PUBLIC_KSS_STAGE must be staging.");
}

const expectedRef = process.env.KSS_STAGING_SUPABASE_PROJECT_REF;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!expectedRef || !/^[a-z]{20}$/.test(expectedRef) ||
  url !== `https://${expectedRef}.supabase.co`) {
  throw new Error("Vercel build blocked: Supabase URL does not match the approved staging project reference.");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  !process.env.KSS_DOCUMENT_SIGNING_SECRET) {
  throw new Error("Vercel build blocked: a required staging credential is missing.");
}
