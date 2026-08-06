export type RecognitionAwardSection =
  | "service"
  | "administrative"
  | "education"
  | "special_groups";

export type RecognitionAwardId =
  | "distinguished_service"
  | "meritorious_service"
  | "meritorious_unit_citation"
  | "ems_life_saving"
  | "dedication_and_devotion"
  | "commissioners_award"
  | "executive_fire_officer"
  | "cpse_designation"
  | "higher_education_degree"
  | "paramedic_service"
  | "certified_fire_marshal"
  | "honor_guard"
  | "hazmat_team"
  | "rescue_technician";

export type RecognitionAward = {
  id: RecognitionAwardId;
  section: RecognitionAwardSection;
  label: string;
  /** Ribbon Program order of precedence (lower = higher precedence). */
  precedence: number;
  ribbonSrc: string;
};

export const recognitionSectionLabels: Record<RecognitionAwardSection, string> = {
  service: "Service",
  administrative: "Administrative",
  education: "Education",
  special_groups: "Special Groups",
};

/** Ribbon Program sections 2–5 (Valor excluded). */
export const recognitionAwards = [
  {
    id: "distinguished_service",
    section: "service",
    label: "Distinguished Service Ribbon",
    precedence: 4,
    ribbonSrc: "/ribbons/distinguished_service.png",
  },
  {
    id: "meritorious_service",
    section: "service",
    label: "Meritorious Service Ribbon",
    precedence: 5,
    ribbonSrc: "/ribbons/meritorious_service.png",
  },
  {
    id: "meritorious_unit_citation",
    section: "service",
    label: "Meritorious Unit Citation Ribbon",
    precedence: 6,
    ribbonSrc: "/ribbons/meritorious_unit_citation.png",
  },
  {
    id: "ems_life_saving",
    section: "service",
    label: "EMS Life Saving Intervention Ribbon",
    precedence: 7,
    ribbonSrc: "/ribbons/ems_life_saving.png",
  },
  {
    id: "dedication_and_devotion",
    section: "administrative",
    label: "Dedication and Devotion Ribbon",
    precedence: 8,
    ribbonSrc: "/ribbons/dedication_and_devotion.png",
  },
  {
    id: "commissioners_award",
    section: "administrative",
    label: "Commissioners' Award Ribbon",
    precedence: 9,
    ribbonSrc: "/ribbons/commissioners_award.png",
  },
  {
    id: "executive_fire_officer",
    section: "education",
    label: "Executive Fire Officer Ribbon",
    precedence: 10,
    ribbonSrc: "/ribbons/executive_fire_officer.png",
  },
  {
    id: "cpse_designation",
    section: "education",
    label: "Center for Public Safety Excellence (CPSE) Designation Ribbon",
    precedence: 11,
    ribbonSrc: "/ribbons/cpse_designation.svg",
  },
  {
    id: "higher_education_degree",
    section: "education",
    label: "Higher Education Degree Ribbon",
    precedence: 12,
    ribbonSrc: "/ribbons/higher_education_degree.png",
  },
  {
    id: "paramedic_service",
    section: "education",
    label: "Paramedic Service Ribbon",
    precedence: 13,
    ribbonSrc: "/ribbons/paramedic_service.png",
  },
  {
    id: "certified_fire_marshal",
    section: "education",
    label: "Certified Fire Marshal Ribbon",
    precedence: 14,
    ribbonSrc: "/ribbons/certified_fire_marshal.png",
  },
  {
    id: "honor_guard",
    section: "special_groups",
    label: "Honor Guard Ribbon",
    precedence: 15,
    ribbonSrc: "/ribbons/honor_guard.png",
  },
  {
    id: "hazmat_team",
    section: "special_groups",
    label: "Hazardous Materials Team Member Ribbon",
    precedence: 16,
    ribbonSrc: "/ribbons/hazmat_team.png",
  },
  {
    id: "rescue_technician",
    section: "special_groups",
    label: "Rescue Technician Ribbon",
    precedence: 17,
    ribbonSrc: "/ribbons/rescue_technician.png",
  },
] as const satisfies readonly RecognitionAward[];

const recognitionAwardById = new Map(
  recognitionAwards.map((award) => [award.id, award] as const)
);

export function getRecognitionAward(awardId: string): RecognitionAward | undefined {
  return recognitionAwardById.get(awardId as RecognitionAwardId);
}

export function isRecognitionAwardId(value: string): value is RecognitionAwardId {
  return recognitionAwardById.has(value as RecognitionAwardId);
}

export const recognitionAwardIds = recognitionAwards.map((a) => a.id);

export function recognitionAwardsBySection() {
  const sections: RecognitionAwardSection[] = [
    "service",
    "administrative",
    "education",
    "special_groups",
  ];
  return sections.map((section) => ({
    section,
    label: recognitionSectionLabels[section],
    awards: recognitionAwards.filter((a) => a.section === section),
  }));
}
