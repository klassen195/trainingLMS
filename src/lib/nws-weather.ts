import {
  DEFAULT_WEATHER_LOCATION,
  type FlagAlert,
  type WeatherDay,
  type WeatherSnapshot,
} from "@/lib/home-dashboard-types";

const NWS_USER_AGENT = "AnchorPoint/1.0 (department operations dashboard)";

type NwsPoints = {
  properties?: {
    forecast?: string;
    forecastHourly?: string;
    relativeLocation?: {
      properties?: {
        city?: string;
        state?: string;
      };
    };
  };
};

type NwsPeriod = {
  name?: string;
  startTime?: string;
  isDaytime?: boolean;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
};

type NwsForecast = {
  properties?: {
    periods?: NwsPeriod[];
  };
};

type NwsAlertFeature = {
  properties?: {
    event?: string;
    headline?: string;
    ends?: string | null;
    expires?: string | null;
  };
};

function dateKeyInZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function weekdayInZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(new Date(iso));
}

async function nwsFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": NWS_USER_AGENT,
      Accept: "application/geo+json",
    },
    next: { revalidate: 600 },
  });
  if (!response.ok) {
    throw new Error(`Weather service returned ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function loadNwsWeather(input: {
  latitude: number;
  longitude: number;
  label: string;
  timeZone?: string;
}): Promise<WeatherSnapshot> {
  const timeZone = input.timeZone ?? DEFAULT_WEATHER_LOCATION.timeZone;
  const points = await nwsFetch<NwsPoints>(
    `https://api.weather.gov/points/${input.latitude.toFixed(4)},${input.longitude.toFixed(4)}`
  );
  const forecastUrl = points.properties?.forecast;
  const hourlyUrl = points.properties?.forecastHourly;
  if (!forecastUrl) throw new Error("No forecast is available for this location.");

  const [forecast, hourly] = await Promise.all([
    nwsFetch<NwsForecast>(forecastUrl),
    hourlyUrl ? nwsFetch<NwsForecast>(hourlyUrl).catch(() => null) : Promise.resolve(null),
  ]);

  const city = points.properties?.relativeLocation?.properties?.city;
  const state = points.properties?.relativeLocation?.properties?.state;
  const locationLabel =
    city && state ? `${city}, ${state}` : city || input.label;

  const hourlyPeriods = hourly?.properties?.periods ?? [];
  const dailyPeriods = forecast.properties?.periods ?? [];
  const current = hourlyPeriods[0] ?? dailyPeriods[0];
  if (!current) throw new Error("Forecast is empty.");

  const todayKey = dateKeyInZone(new Date().toISOString(), timeZone);
  const byDate = new Map<string, WeatherDay>();
  for (const period of dailyPeriods) {
    if (!period.startTime) continue;
    const key = dateKeyInZone(period.startTime, timeZone);
    const existing = byDate.get(key) ?? {
      dateKey: key,
      name: key === todayKey ? "Today" : weekdayInZone(period.startTime, timeZone),
      high: null,
      low: null,
      unit: period.temperatureUnit ?? "F",
      forecast: period.shortForecast ?? "",
      wind: period.windSpeed
        ? `${period.windSpeed}${period.windDirection ? ` ${period.windDirection}` : ""}`
        : null,
    };
    if (period.isDaytime) {
      existing.high = period.temperature ?? existing.high;
      existing.forecast = period.shortForecast ?? existing.forecast;
      existing.wind = period.windSpeed
        ? `${period.windSpeed}${period.windDirection ? ` ${period.windDirection}` : ""}`
        : existing.wind;
    } else {
      existing.low = period.temperature ?? existing.low;
    }
    byDate.set(key, existing);
  }

  const upcoming = [...byDate.values()]
    .filter((day) => day.dateKey >= todayKey)
    .slice(0, 3);

  return {
    locationLabel,
    currentTemp: typeof current.temperature === "number" ? current.temperature : null,
    currentUnit: current.temperatureUnit ?? "F",
    currentForecast: current.shortForecast ?? "—",
    currentWind: current.windSpeed
      ? `${current.windSpeed}${current.windDirection ? ` ${current.windDirection}` : ""}`
      : null,
    days: upcoming,
  };
}

export async function loadNwsFlagAlerts(input: {
  latitude: number;
  longitude: number;
}): Promise<FlagAlert[]> {
  const payload = await nwsFetch<{ features?: NwsAlertFeature[] }>(
    `https://api.weather.gov/alerts/active?point=${input.latitude.toFixed(4)},${input.longitude.toFixed(4)}`
  );
  return (payload.features ?? [])
    .map((feature) => {
      const event = feature.properties?.event?.trim() ?? "";
      if (!/red flag/i.test(event) && !/fire weather watch/i.test(event)) return null;
      return {
        event,
        headline: feature.properties?.headline?.trim() || event,
        ends: feature.properties?.ends ?? feature.properties?.expires ?? null,
      };
    })
    .filter((alert): alert is FlagAlert => Boolean(alert));
}
