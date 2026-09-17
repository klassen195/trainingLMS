import type { FlagLevel } from "@/lib/home-dashboard-types";

export const CDC_FIRE_DANGER_ZONE = "South Valleys" as const;

export const CDC_SOUTH_VALLEYS_GIF_URL =
  "https://gacc.nifc.gov/nrcc/dc/idcdc/Smokey/HOME/South%20Valleys/CurrentConditions.gif";

export const CDC_DISPATCH_HOME_URL = "https://gacc.nifc.gov/nrcc/dc/idcdc/";

const USER_AGENT = "AnchorPoint/1.0 (department operations dashboard)";

const RATED_LEVELS = ["low", "moderate", "high", "very_high", "extreme"] as const;
type RatedLevel = (typeof RATED_LEVELS)[number];

export type CdcFireDangerSnapshot = {
  level: RatedLevel;
  zone: typeof CDC_FIRE_DANGER_ZONE;
  sourceUrl: string;
  imageUrl: string;
  fetchedAt: string;
  imageUpdatedAt: string | null;
};

function classifyPixel(r: number, g: number, b: number): RatedLevel | null {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const val = max / 255;
  if (val < 0.3 || sat < 0.45) return null;

  // Skip yellow-orange headline text ("FIRE DANGER" / "TODAY!").
  if (r > 190 && g > 140 && b < 130 && val > 0.7) return null;

  // Skip Smokey brown / hat / skin tones.
  const brownish =
    r > 60 && g > 30 && b < 100 && Math.abs(r - g) < 90 && r - b > 20 && g - b > 10 && sat < 0.82;
  if (brownish) return null;

  const delta = max - min;
  if (delta === 0) return null;

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;
  if (hue < 0) hue += 360;

  if (hue >= 95 && hue <= 165) return "low";
  if (hue >= 190 && hue <= 255) return "moderate";
  if (hue >= 50 && hue <= 90) return "high";
  if (hue >= 22 && hue < 50) return "very_high";
  if (hue < 15 || hue >= 350) return "extreme";
  return null;
}

export function detectFireDangerLevelFromGifPixels(
  data: Buffer | Uint8Array,
  width: number,
  height: number
): RatedLevel {
  const counts: Record<RatedLevel, number> = {
    low: 0,
    moderate: 0,
    high: 0,
    very_high: 0,
    extreme: 0,
  };

  // Rating pill sits in the left-center of the 160x60 Smokey banner.
  const x0 = Math.floor(width * 0.08);
  const x1 = Math.floor(width * 0.5);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.floor(height * 0.65);

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      const level = classifyPixel(data[i]!, data[i + 1]!, data[i + 2]!);
      if (level) counts[level] += 1;
    }
  }

  const ranked = RATED_LEVELS.map((level) => ({ level, count: counts[level] })).sort(
    (a, b) => b.count - a.count
  );
  const winner = ranked[0]!;
  const runnerUp = ranked[1]!;

  if (winner.count < 120) {
    throw new Error("Could not read a clear fire-danger color from the CDC banner.");
  }
  if (runnerUp.count > 0 && winner.count < runnerUp.count * 1.5) {
    throw new Error("CDC banner colors were ambiguous; fire danger was not updated.");
  }

  return winner.level;
}

async function decodeGif(buffer: Buffer) {
  // Dynamic import so a missing/broken sharp binary cannot take down the home page at module load.
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 3) {
    throw new Error("Unexpected CDC banner image format.");
  }
  return { data, width: info.width, height: info.height };
}

export async function loadCdcSouthValleysFireDanger(): Promise<CdcFireDangerSnapshot> {
  const response = await fetch(CDC_SOUTH_VALLEYS_GIF_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/gif,image/*,*/*" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`CDC fire-danger banner returned ${response.status}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 100) {
    throw new Error("CDC fire-danger banner was empty.");
  }

  const decoded = await decodeGif(buffer);
  const level = detectFireDangerLevelFromGifPixels(decoded.data, decoded.width, decoded.height);
  const imageUpdatedAt = response.headers.get("last-modified");

  return {
    level,
    zone: CDC_FIRE_DANGER_ZONE,
    sourceUrl: CDC_DISPATCH_HOME_URL,
    imageUrl: CDC_SOUTH_VALLEYS_GIF_URL,
    fetchedAt: new Date().toISOString(),
    imageUpdatedAt: imageUpdatedAt ? new Date(imageUpdatedAt).toISOString() : null,
  };
}

export function isRatedFlagLevel(level: FlagLevel): level is RatedLevel {
  return (RATED_LEVELS as readonly string[]).includes(level);
}
