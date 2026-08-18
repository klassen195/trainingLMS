export function hasSupabaseSessionCookie(cookies: { name: string }[]) {
  return cookies.some(
    (cookie) => cookie.name.includes("-auth-token") && !cookie.name.includes("code-verifier")
  );
}
