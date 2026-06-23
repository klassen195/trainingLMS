export function getSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Save training-lms/.env and restart npm run dev."
    );
  }

  const url = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");

  return { url, anonKey };
}
