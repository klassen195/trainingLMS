import { CHANGE_PASSWORD_PATH } from "@/lib/auth-password";

export function safeAppPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (
    next === "/login" ||
    next.startsWith("/login/") ||
    next.startsWith("/auth") ||
    next === CHANGE_PASSWORD_PATH
  ) {
    return fallback;
  }
  return next;
}
