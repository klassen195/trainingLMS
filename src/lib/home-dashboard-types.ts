export const HOME_WIDGET_TYPES = [
  "weather",
  "fire_danger",
  "flag_mast",
  "apparatus_oos",
  "approvals_queue",
  "open_taskbooks",
] as const;

export type HomeWidgetType = (typeof HOME_WIDGET_TYPES)[number];

export const FLAG_LEVELS = ["unset", "low", "moderate", "high", "very_high", "extreme"] as const;
export type FlagLevel = (typeof FLAG_LEVELS)[number];

export const DEFAULT_WEATHER_LOCATION = {
  latitude: 47.677683,
  longitude: -116.780466,
  label: "Coeur d'Alene",
  timeZone: "America/Los_Angeles",
} as const;

export type HomeWidgetCatalogItem = {
  type: HomeWidgetType;
  title: string;
  description: string;
};

export const HOME_WIDGET_CATALOG: Record<HomeWidgetType, Omit<HomeWidgetCatalogItem, "type">> = {
  weather: {
    title: "Weather",
    description: "Current conditions and the next two days.",
  },
  fire_danger: {
    title: "Fire Danger",
    description: "Today’s fire-danger rating and any Red Flag Warning.",
  },
  flag_mast: {
    title: "U.S. Flag",
    description: "Whether the flag should fly at half-staff or full staff today.",
  },
  apparatus_oos: {
    title: "Apparatus Status",
    description: "Apparatus currently marked out of service.",
  },
  approvals_queue: {
    title: "Document Status",
    description: "Approval-tracker documents at your stage.",
  },
  open_taskbooks: {
    title: "Open taskbooks",
    description: "Taskbooks you have requested or are working.",
  },
};

export function isHomeWidgetType(value: string): value is HomeWidgetType {
  return (HOME_WIDGET_TYPES as readonly string[]).includes(value);
}

function normalizeWidgetType(value: string): string {
  if (value === "flag_status") return "fire_danger";
  return value;
}

export function parseHomeWidgetTypes(value: unknown): HomeWidgetType[] | null {
  if (!Array.isArray(value)) return null;
  const types: HomeWidgetType[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const type = normalizeWidgetType(item);
    if (!isHomeWidgetType(type)) continue;
    if (!types.includes(type)) types.push(type);
  }
  return types;
}

export function isFlagLevel(value: string): value is FlagLevel {
  return (FLAG_LEVELS as readonly string[]).includes(value);
}

export function flagLevelLabel(level: FlagLevel) {
  switch (level) {
    case "unset":
      return "Not posted";
    case "low":
      return "Low";
    case "moderate":
      return "Moderate";
    case "high":
      return "High";
    case "very_high":
      return "Very high";
    case "extreme":
      return "Extreme";
  }
}

export type WeatherDay = {
  dateKey: string;
  name: string;
  high: number | null;
  low: number | null;
  unit: string;
  forecast: string;
  wind: string | null;
};

export type WeatherSnapshot = {
  locationLabel: string;
  currentTemp: number | null;
  currentUnit: string;
  currentForecast: string;
  currentWind: string | null;
  days: WeatherDay[];
};

export type FlagAlert = {
  event: string;
  headline: string;
  ends: string | null;
};

export type FlagSnapshot = {
  level: FlagLevel;
  updatedAt: string | null;
  updatedByName: string | null;
  alerts: FlagAlert[];
};

export type ApparatusOosItem = {
  id: string;
  label: string;
  station: string | null;
  typeLabel: string | null;
};

export type ApprovalQueueItem = {
  id: string;
  title: string;
  docTypeLabel: string;
  stageLabel: string;
  daysInStage: string;
};

export type OpenTaskbookItem = {
  id: string;
  rank: string;
  statusLabel: string;
  dueLabel: string | null;
  overdue: boolean;
};

export type FlagMastPosition = "full" | "half";

export type FlagMastSnapshot = {
  position: FlagMastPosition;
  reason: string | null;
  source: string | null;
  idahoPosition: FlagMastPosition | null;
};

export type HomeDashboardData = {
  weather: WeatherSnapshot | { error: string } | null;
  flag: FlagSnapshot | null;
  flagMast: FlagMastSnapshot | { error: string } | null;
  apparatus: ApparatusOosItem[] | { error: string } | null;
  approvals: ApprovalQueueItem[] | { error: string } | null;
  taskbooks: OpenTaskbookItem[] | { error: string } | null;
};

export type HomeDashboardPayload = {
  profileId: string;
  greetingName: string;
  widgets: HomeWidgetType[];
  availableWidgets: HomeWidgetCatalogItem[];
  canEditFlag: boolean;
  layoutPersisted: boolean;
  data: HomeDashboardData;
};
