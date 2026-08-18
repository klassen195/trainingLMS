export function safeAppPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next === "/login" || next.startsWith("/login/") || next.startsWith("/auth")) return fallback;
  return next;
}
