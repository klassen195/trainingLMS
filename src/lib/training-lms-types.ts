export type UserRole = "admin" | "instructor" | "learner";

export type ProgramCategory = "fire" | "engineer" | "officer" | "battalion_chief" | "ems";

export type ProgramStatus = "draft" | "published" | "archived";

export type EnrollmentStatus = "active" | "completed";

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  rank: string | null;
  role: UserRole;
  created_at: string;
};

export type Program = {
  id: string;
  title: string;
  description: string | null;
  category: ProgramCategory;
  status: ProgramStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Module = {
  id: string;
  program_id: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
};

export type Enrollment = {
  id: string;
  program_id: string;
  user_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
};

export type ModuleProgress = {
  id: string;
  module_id: string;
  user_id: string;
  completed_at: string;
};
