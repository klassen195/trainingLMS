import { DEFAULT_WEATHER_LOCATION, type FlagMastPosition, type FlagMastSnapshot } from "@/lib/home-dashboard-types";

const USER_AGENT = "AnchorPoint/1.0 (department operations dashboard)";
const FLAG_WATCH_URL = "https://flagwatch.net/api/v1/";
const IDAHO_FLAG_URL = "https://gov.idaho.gov/flag-status/";

type FlagWatchItem = {
  order_from?: string;
  reason?: string;
  url?: string;
  start_date?: string;
  end_date?: string | null;
};

type FlagWatchFeed = {
  is_half_staff_today?: boolean;
  as_of?: string;
  items?: FlagWatchItem[];
};

function todayKey(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hourInZone(timeZone: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date())
  );
}

function lastMondayOfMayKey(year: number) {
  const last = new Date(Date.UTC(year, 4, 31, 12, 0, 0));
  last.setUTCDate(31 - ((last.getUTCDay() + 6) % 7));
  return last.toISOString().slice(0, 10);
}

function statutoryObservance(today: string, hour: number): { reason: string; untilNoon?: boolean } | null {
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month === 5 && day === 4) {
    return { reason: "National Fallen Firefighters Memorial" };
  }
  if (month === 5 && day === 15) {
    return { reason: "Peace Officers Memorial Day" };
  }
  if (month === 5 && today === lastMondayOfMayKey(year)) {
    if (hour >= 12) return null;
    return { reason: "Memorial Day (half-staff until noon)", untilNoon: true };
  }
  if (month === 7 && day === 27) {
    return { reason: "National Korean War Veterans Armistice Day" };
  }
  if (month === 9 && day === 11) {
    return { reason: "Patriot Day" };
  }
  if (month === 12 && day === 7) {
    return { reason: "Pearl Harbor Remembrance Day" };
  }
  return null;
}

function itemCoversToday(item: FlagWatchItem, today: string) {
  if (!item.start_date) return false;
  if (item.end_date) return item.start_date <= today && today <= item.end_date;
  return item.start_date === today;
}

function parseIdahoPosition(html: string): FlagMastPosition | null {
  const usMatch = html.match(/USA Flag Status[\s\S]{0,200}?Flag at (full|half)[-\s]?staff/i);
  if (usMatch?.[1]) return usMatch[1].toLowerCase() === "half" ? "half" : "full";
  const compact = html.match(
    /USA Flag StatusFlag at (full|half)[-\s]?staff[\s\S]{0,80}Idaho Flag StatusFlag at (full|half)[-\s]?staff/i
  );
  if (compact?.[1]) return compact[1].toLowerCase() === "half" ? "half" : "full";
  return null;
}

function parseIdahoStatePosition(html: string): FlagMastPosition | null {
  const compact = html.match(
    /USA Flag StatusFlag at (?:full|half)[-\s]?staff[\s\S]{0,80}Idaho Flag StatusFlag at (full|half)[-\s]?staff/i
  );
  if (compact?.[1]) return compact[1].toLowerCase() === "half" ? "half" : "full";
  const idahoMatch = html.match(/Idaho Flag Status[\s\S]{0,200}?Flag at (full|half)[-\s]?staff/i);
  if (idahoMatch?.[1]) return idahoMatch[1].toLowerCase() === "half" ? "half" : "full";
  return null;
}

async function loadFlagWatch(today: string): Promise<{
  half: boolean;
  reason: string | null;
  source: string | null;
} | null> {
  const response = await fetch(FLAG_WATCH_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`Flag Watch returned ${response.status}.`);
  const feed = (await response.json()) as FlagWatchFeed;
  const covering = (feed.items ?? []).find((item) => itemCoversToday(item, today));
  const half = Boolean(feed.is_half_staff_today) || Boolean(covering);
  return {
    half,
    reason: covering?.reason?.trim() || null,
    source: covering?.order_from?.trim() || (half ? "Presidential order" : null),
  };
}

async function loadIdahoHtml(): Promise<string | null> {
  const response = await fetch(IDAHO_FLAG_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    next: { revalidate: 600 },
  });
  if (!response.ok) return null;
  return response.text();
}

export async function loadFlagMastStatus(): Promise<FlagMastSnapshot> {
  const timeZone = DEFAULT_WEATHER_LOCATION.timeZone;
  const today = todayKey(timeZone);
  const hour = hourInZone(timeZone);
  const statutory = statutoryObservance(today, hour);

  const [watchResult, idahoResult] = await Promise.allSettled([loadFlagWatch(today), loadIdahoHtml()]);

  const watch = watchResult.status === "fulfilled" ? watchResult.value : null;
  const idahoHtml = idahoResult.status === "fulfilled" ? idahoResult.value : null;
  const idahoUs = idahoHtml ? parseIdahoPosition(idahoHtml) : null;
  const idahoState = idahoHtml ? parseIdahoStatePosition(idahoHtml) : null;

  const federalHalf = Boolean(watch?.half) || Boolean(statutory);
  const idahoHalf = idahoUs === "half" || idahoState === "half";
  const half = federalHalf || idahoHalf;

  const reason =
    watch?.reason ||
    statutory?.reason ||
    (idahoHalf ? "Ordered at half-staff in Idaho" : null);
  const source =
    watch?.source ||
    (statutory ? "U.S. Flag Code" : null) ||
    (idahoHalf ? "Idaho Governor" : null);

  if (!watch && !idahoHtml && !statutory) {
    throw new Error("Flag status is unavailable.");
  }

  return {
    position: half ? "half" : "full",
    reason: half ? reason : null,
    source: half ? source : null,
    idahoPosition: idahoState,
  };
}
