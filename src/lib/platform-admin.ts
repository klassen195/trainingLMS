export function isPlatformAdminFromUser(
  user: { app_metadata?: Record<string, unknown> } | null | undefined
): boolean {
  return Boolean(user?.app_metadata?.is_platform_admin);
}
