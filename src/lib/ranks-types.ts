export type PersonnelRank = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  notes: string;
  has_title: boolean;
  title_only: boolean;
  no_probation: boolean;
  swing_up_eligible: boolean;
};

export const PERSONNEL_RANK_SELECT =
  "id, created_at, updated_at, name, sort_order, is_active, notes, has_title, title_only, no_probation, swing_up_eligible";

/** Fallback flags when the catalog row is missing (legacy / renamed ranks). */
export type RankBehavior = {
  has_title: boolean;
  title_only: boolean;
  no_probation: boolean;
  swing_up_eligible: boolean;
};

const FALLBACK_RANK_BEHAVIOR: Record<string, RankBehavior> = {
  Firefighter: {
    has_title: false,
    title_only: false,
    no_probation: false,
    swing_up_eligible: false,
  },
  Engineer: {
    has_title: false,
    title_only: false,
    no_probation: false,
    swing_up_eligible: true,
  },
  Captain: {
    has_title: false,
    title_only: false,
    no_probation: false,
    swing_up_eligible: true,
  },
  "Battalion Chief": {
    has_title: false,
    title_only: false,
    no_probation: false,
    swing_up_eligible: true,
  },
  "Assistant Chief": {
    has_title: true,
    title_only: false,
    no_probation: true,
    swing_up_eligible: false,
  },
  "Division Chief": {
    has_title: true,
    title_only: false,
    no_probation: true,
    swing_up_eligible: false,
  },
  "Fire Chief": {
    has_title: false,
    title_only: false,
    no_probation: true,
    swing_up_eligible: false,
  },
  Administration: {
    has_title: true,
    title_only: true,
    no_probation: true,
    swing_up_eligible: false,
  },
};

export function findPersonnelRank(
  catalog: readonly PersonnelRank[] | null | undefined,
  name: string | null | undefined
) {
  if (!name || !catalog?.length) return null;
  return catalog.find((row) => row.name === name) ?? null;
}

export function rankBehavior(
  name: string | null | undefined,
  catalog?: readonly PersonnelRank[] | null
): RankBehavior {
  const fromCatalog = findPersonnelRank(catalog, name);
  if (fromCatalog) {
    return {
      has_title: fromCatalog.has_title,
      title_only: fromCatalog.title_only,
      no_probation: fromCatalog.no_probation,
      swing_up_eligible: fromCatalog.swing_up_eligible,
    };
  }
  if (name && FALLBACK_RANK_BEHAVIOR[name]) {
    return FALLBACK_RANK_BEHAVIOR[name];
  }
  return {
    has_title: false,
    title_only: false,
    no_probation: false,
    swing_up_eligible: false,
  };
}

export function swingUpRanksFromCatalog(catalog: readonly PersonnelRank[]) {
  return catalog
    .filter((row) => row.is_active && row.swing_up_eligible)
    .map((row) => row.name);
}

export function activeRankNames(catalog: readonly PersonnelRank[]) {
  return catalog.filter((row) => row.is_active).map((row) => row.name);
}
