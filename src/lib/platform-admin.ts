export function isPlatformAdminFromUser(
  user: { app_metadata?: Record<string, unknown> } | null | undefined
): boolean {
  return Boolean(user?.app_metadata?.is_platform_admin);
}

/** Eligible to enter platform mode (may or may not be elevated right now). */
export function isPlatformOperatorEligibleFromUser(
  user: { app_metadata?: Record<string, unknown> } | null | undefined
): boolean {
  return (
    Boolean(user?.app_metadata?.platform_operator_eligible) ||
    Boolean(user?.app_metadata?.is_platform_admin)
  );
}
