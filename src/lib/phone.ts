/** Keep up to 10 NANP digits; drop a leading country code 1 when present. */
export function phoneDigits(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

/** Progressive input mask: (123) 456-7890 */
export function formatPhoneInput(value: string) {
  const digits = phoneDigits(value);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Display helper; returns `empty` when there are no digits. */
export function formatPhoneNumber(value: string | null | undefined, empty = "—") {
  const digits = phoneDigits(value);
  if (!digits) return empty;
  return formatPhoneInput(digits);
}
