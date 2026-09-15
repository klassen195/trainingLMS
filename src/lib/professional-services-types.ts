export const PROFESSIONAL_SERVICE_CATEGORIES = [
  "doctor",
  "dentist",
  "physical_therapy",
  "chiropractor",
  "mechanic",
  "contractor",
  "veterinarian",
  "attorney",
  "financial_advisor",
  "home_services",
  "other",
] as const;

export type ProfessionalServiceCategory = (typeof PROFESSIONAL_SERVICE_CATEGORIES)[number];

export const PROFESSIONAL_SERVICE_CATEGORY_LABELS: Record<ProfessionalServiceCategory, string> = {
  doctor: "Doctor",
  dentist: "Dentist",
  physical_therapy: "Physical Therapy",
  chiropractor: "Chiropractor",
  mechanic: "Mechanic",
  contractor: "Contractor",
  veterinarian: "Veterinarian",
  attorney: "Attorney",
  financial_advisor: "Financial advisor",
  home_services: "Home services",
  other: "Other",
};

export const PROFESSIONAL_SERVICE_VERDICTS = ["recommend", "recommend_against"] as const;

export type ProfessionalServiceVerdict = (typeof PROFESSIONAL_SERVICE_VERDICTS)[number];

export type ProfessionalServiceCreator = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type ProfessionalServiceProvider = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  category: ProfessionalServiceCategory;
  specialty: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  address: string;
  notes: string;
  is_hidden: boolean;
  created_by: string | null;
  creator: ProfessionalServiceCreator | null;
};

export type ProfessionalServicePractitioner = {
  id: string;
  created_at: string;
  updated_at: string;
  provider_id: string;
  name: string;
  role_title: string;
  notes: string;
  is_hidden: boolean;
  created_by: string | null;
  creator: ProfessionalServiceCreator | null;
};

export type ProfessionalServiceReview = {
  id: string;
  created_at: string;
  updated_at: string;
  provider_id: string;
  practitioner_id: string | null;
  verdict: ProfessionalServiceVerdict;
  is_anonymous: boolean;
  body: string;
  used_for: string;
  service_date: string | null;
  created_by: string;
  creator: ProfessionalServiceCreator | null;
  practitioner: Pick<ProfessionalServicePractitioner, "id" | "name" | "role_title"> | null;
};

export type ProfessionalServiceReviewTallies = {
  recommend: number;
  recommend_against: number;
  total: number;
};

export const PROFESSIONAL_SERVICE_PROVIDER_SELECT =
  "id, created_at, updated_at, name, category, specialty, phone, email, website, city, address, notes, is_hidden, created_by, creator:profiles!created_by(id, display_name, first_name, last_name, email)";

export const PROFESSIONAL_SERVICE_PRACTITIONER_SELECT =
  "id, created_at, updated_at, provider_id, name, role_title, notes, is_hidden, created_by, creator:profiles!created_by(id, display_name, first_name, last_name, email)";

export const PROFESSIONAL_SERVICE_REVIEW_SELECT =
  "id, created_at, updated_at, provider_id, practitioner_id, verdict, is_anonymous, body, used_for, service_date, created_by, creator:profiles!created_by(id, display_name, first_name, last_name, email), practitioner:professional_service_practitioners!practitioner_id(id, name, role_title)";

export function isProfessionalServiceCategory(value: string): value is ProfessionalServiceCategory {
  return (PROFESSIONAL_SERVICE_CATEGORIES as readonly string[]).includes(value);
}

export function isProfessionalServiceVerdict(value: string): value is ProfessionalServiceVerdict {
  return (PROFESSIONAL_SERVICE_VERDICTS as readonly string[]).includes(value);
}

export function professionalServiceCreatorName(
  creator: ProfessionalServiceCreator | null | undefined
) {
  if (!creator) return null;
  const firstLast = [creator.first_name, creator.last_name].filter(Boolean).join(" ").trim();
  return firstLast || creator.display_name || creator.email || null;
}

export function reviewAuthorLabel(
  review: ProfessionalServiceReview,
  options?: { revealAnonymous?: boolean }
) {
  if (review.is_anonymous && !options?.revealAnonymous) return "Anonymous";
  const name = professionalServiceCreatorName(review.creator) || "Member";
  if (review.is_anonymous && options?.revealAnonymous) return `${name} (anonymous)`;
  return name;
}

export function reviewTargetKey(practitionerId: string | null | undefined) {
  return practitionerId ?? "practice";
}

export function findReviewForTarget(
  reviews: ProfessionalServiceReview[],
  userId: string,
  practitionerId: string | null
) {
  return (
    reviews.find(
      (review) =>
        review.created_by === userId &&
        (review.practitioner_id ?? null) === (practitionerId ?? null)
    ) ?? null
  );
}

/** Hide anonymous author profile embeds from other members (keep for self/admin). */
export function sanitizeReviewForViewer(
  review: ProfessionalServiceReview,
  viewerId: string,
  viewerIsAdmin: boolean
): ProfessionalServiceReview {
  if (!review.is_anonymous) return review;
  if (review.created_by === viewerId || viewerIsAdmin) return review;
  return { ...review, creator: null };
}

export function tallyReviews(reviews: ProfessionalServiceReview[]): ProfessionalServiceReviewTallies {
  let recommend = 0;
  let recommend_against = 0;
  for (const review of reviews) {
    if (review.verdict === "recommend") recommend += 1;
    else recommend_against += 1;
  }
  return { recommend, recommend_against, total: recommend + recommend_against };
}

export function orgReviews(reviews: ProfessionalServiceReview[]) {
  return reviews.filter((review) => !review.practitioner_id);
}

export function practitionerReviews(
  reviews: ProfessionalServiceReview[],
  practitionerId: string
) {
  return reviews.filter((review) => review.practitioner_id === practitionerId);
}

export function categoryLabel(category: ProfessionalServiceCategory) {
  return PROFESSIONAL_SERVICE_CATEGORY_LABELS[category];
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function parseProfessionalServiceProviders(rows: unknown): ProfessionalServiceProvider[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as ProfessionalServiceProvider & {
      creator?: ProfessionalServiceCreator | ProfessionalServiceCreator[] | null;
    };
    return {
      ...item,
      specialty: item.specialty ?? "",
      phone: item.phone ?? "",
      email: item.email ?? "",
      website: item.website ?? "",
      city: item.city ?? "",
      address: item.address ?? "",
      notes: item.notes ?? "",
      is_hidden: Boolean(item.is_hidden),
      creator: asSingle(item.creator),
    };
  });
}

export function parseProfessionalServicePractitioners(rows: unknown): ProfessionalServicePractitioner[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as ProfessionalServicePractitioner & {
      creator?: ProfessionalServiceCreator | ProfessionalServiceCreator[] | null;
    };
    return {
      ...item,
      role_title: item.role_title ?? "",
      notes: item.notes ?? "",
      is_hidden: Boolean(item.is_hidden),
      creator: asSingle(item.creator),
    };
  });
}

export function parseProfessionalServiceReviews(rows: unknown): ProfessionalServiceReview[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as ProfessionalServiceReview & {
      creator?: ProfessionalServiceCreator | ProfessionalServiceCreator[] | null;
      practitioner?:
        | Pick<ProfessionalServicePractitioner, "id" | "name" | "role_title">
        | Pick<ProfessionalServicePractitioner, "id" | "name" | "role_title">[]
        | null;
    };
    return {
      ...item,
      practitioner_id: item.practitioner_id ?? null,
      body: item.body ?? "",
      used_for: item.used_for ?? "",
      is_anonymous: Boolean(item.is_anonymous),
      creator: asSingle(item.creator),
      practitioner: asSingle(item.practitioner),
    };
  });
}

export function compareProvidersByName(a: ProfessionalServiceProvider, b: ProfessionalServiceProvider) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function comparePractitionersByName(
  a: ProfessionalServicePractitioner,
  b: ProfessionalServicePractitioner
) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
