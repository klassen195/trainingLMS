export type PostalAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

export function emptyPostalAddress(): PostalAddress {
  return { line1: "", line2: "", city: "", state: "", postalCode: "" };
}

/** US ZIP: 12345 or 12345-6789 */
export function formatPostalCodeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Two-letter state code, uppercase. */
export function formatStateInput(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

const CITY_STATE_ZIP =
  /^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const CITY_STATE_ZIP_LOOSE =
  /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;

function parseCityStateZip(line: string): Pick<PostalAddress, "city" | "state" | "postalCode"> | null {
  const trimmed = line.trim();
  const match = trimmed.match(CITY_STATE_ZIP) ?? trimmed.match(CITY_STATE_ZIP_LOOSE);
  if (!match) return null;
  return {
    city: match[1].trim(),
    state: formatStateInput(match[2]),
    postalCode: formatPostalCodeInput(match[3]),
  };
}

/** Parse stored freeform / multi-line address into components. */
export function parsePostalAddress(value: string | null | undefined): PostalAddress {
  const empty = emptyPostalAddress();
  if (!value?.trim()) return empty;

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return empty;

  const last = lines[lines.length - 1];
  const cityStateZip = parseCityStateZip(last);

  if (cityStateZip) {
    const streetLines = lines.slice(0, -1);
    return {
      line1: streetLines[0] ?? "",
      line2: streetLines.slice(1).join(", "),
      ...cityStateZip,
    };
  }

  // Single blob that isn't City, ST ZIP — keep as street line 1.
  if (lines.length === 1) {
    return { ...empty, line1: lines[0] };
  }

  return {
    line1: lines[0] ?? "",
    line2: lines.slice(1).join(", "),
    city: "",
    state: "",
    postalCode: "",
  };
}

/** Serialize components to a multi-line home_address string. */
export function serializePostalAddress(addr: PostalAddress): string | null {
  const line1 = addr.line1.trim();
  const line2 = addr.line2.trim();
  const city = addr.city.trim();
  const state = formatStateInput(addr.state);
  const postalCode = formatPostalCodeInput(addr.postalCode);

  const region = [state, postalCode].filter(Boolean).join(" ");
  const cityLine = [city, region].filter(Boolean).join(", ");
  const lines = [line1, line2, cityLine].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
}

/** Display helper for profile views. */
export function formatPostalAddressDisplay(value: string | null | undefined, empty = "—") {
  const serialized = serializePostalAddress(parsePostalAddress(value));
  return serialized || empty;
}
