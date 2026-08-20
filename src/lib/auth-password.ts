import { randomBytes } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 8;
export const CHANGE_PASSWORD_PATH = "/account/change-password";
export const MUST_CHANGE_PASSWORD_KEY = "must_change_password";

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  const chars = Array.from(bytes, (byte) => TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

export function userMustChangePassword(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined
): boolean {
  return user?.app_metadata?.[MUST_CHANGE_PASSWORD_KEY] === true;
}

export function claimsMustChangePassword(claims: Record<string, unknown> | null | undefined): boolean {
  const meta = claims?.app_metadata;
  if (!meta || typeof meta !== "object") return false;
  return (meta as Record<string, unknown>)[MUST_CHANGE_PASSWORD_KEY] === true;
}

export function withMustChangePassword(
  appMetadata: Record<string, unknown> | null | undefined,
  value: boolean
): Record<string, unknown> {
  return { ...(appMetadata ?? {}), [MUST_CHANGE_PASSWORD_KEY]: value };
}

export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}
