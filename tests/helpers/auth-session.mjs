// Synthetic test sessions live only in this Node process. Database roles and
// record permissions are still evaluated by Supabase for every request.
const sessions = new Map();
let signIns = 0;
let sessionRequests = 0;

export async function signInWithTestSession(client, { email, password }, projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  sessionRequests++;
  if (!email || !password || !projectUrl) throw new Error('Synthetic test credentials and project URL required');
  const cacheKey = `${projectUrl}\0${email.toLowerCase()}`;
  const cached = sessions.get(cacheKey);
  if (cached && cached.expires_at * 1000 > Date.now() + 90_000) {
    const reused = await client.auth.setSession({
      access_token: cached.access_token,
      refresh_token: cached.refresh_token,
    });
    if (!reused.error) {
      if (reused.data.session) sessions.set(cacheKey, reused.data.session);
      return reused;
    }
    sessions.delete(cacheKey);
  }
  const result = await client.auth.signInWithPassword({ email, password });
  signIns++;
  if (!result.error && result.data.session) sessions.set(cacheKey, result.data.session);
  return result;
}

export function testSessionStats() {
  return { signIns, sessionRequests, cachedPersonas: sessions.size };
}

if (process.env.KSS_TEST_AUTH_STATS === '1') {
  process.once('exit', () => {
    process.stdout.write(`Synthetic Auth sign-ins: ${signIns}; session requests: ${sessionRequests}; cached personas: ${sessions.size}\n`);
  });
}
