import type { AppCapability } from "@/lib/capabilities";

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  href: string;
  requiredCapabilities: AppCapability[];
};

export const REPORT_CATALOG: ReportDefinition[] = [
  {
    id: "expiring-credentials",
    title: "Expiring credentials",
    description: "Certifications, EMS licenses, and qualifications nearing or past expiry.",
    href: "/reports/expiring-credentials",
    requiredCapabilities: ["access_personnel"],
  },
  {
    id: "certifications",
    title: "Certifications",
    description: "Certifications for a selected person — active only, or including expired.",
    href: "/reports/certifications",
    requiredCapabilities: ["access_personnel"],
  },
  {
    id: "pdip",
    title: "PDIP",
    description:
      "Active PDIP-eligible certifications, qualifications, completed taskbooks, and verified languages for a selected person, with totals.",
    href: "/reports/pdip",
    requiredCapabilities: ["access_personnel", "access_pdip"],
  },
  {
    id: "fleet-status",
    title: "Fleet status",
    description: "Apparatus status, open work orders, and preventive maintenance due dates.",
    href: "/reports/fleet-status",
    requiredCapabilities: ["view_fleet"],
  },
  {
    id: "training-hours",
    title: "Total Training Hours",
    description: "Logged training hours totaled by person for a selected date range.",
    href: "/reports/training-hours",
    requiredCapabilities: ["document_training"],
  },
  {
    id: "individual-training-hours",
    title: "Individual Training Hours",
    description: "Each training session attended by a selected person for a date range.",
    href: "/reports/individual-training-hours",
    requiredCapabilities: ["document_training"],
  },
  {
    id: "lms-progress",
    title: "LMS progress",
    description: "Module enrollment and completion progress across the department.",
    href: "/reports/lms-progress",
    requiredCapabilities: ["access_programs"],
  },
  {
    id: "ppe-due",
    title: "PPE expiry & inspection due",
    description: "Equipment expiry dates and upcoming or overdue inspections.",
    href: "/reports/ppe-due",
    requiredCapabilities: ["access_assets"],
  },
];

export type ReportColumn = {
  key: string;
  header: string;
  /** Defaults to text. Image cells expect a URL string (and optional mime/fileName companion keys). */
  format?: "text" | "image";
  mimeKey?: string;
  fileNameKey?: string;
};

export type ReportBranding = {
  departmentName: string;
  logoDataUrl: string | null;
};

export type ReportExportMeta = {
  title: string;
  filterSummary?: string;
  generatedAt?: Date;
};
