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
    id: "fleet-status",
    title: "Fleet status",
    description: "Apparatus status, open work orders, and preventive maintenance due dates.",
    href: "/reports/fleet-status",
    requiredCapabilities: ["view_fleet"],
  },
  {
    id: "training-hours",
    title: "Document training hours",
    description: "Logged training hours by person for a selected date range.",
    href: "/reports/training-hours",
    requiredCapabilities: ["document_training"],
  },
  {
    id: "lms-progress",
    title: "LMS progress",
    description: "Program enrollment and completion progress across the department.",
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
