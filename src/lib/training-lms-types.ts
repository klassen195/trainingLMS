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
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
};

export type ProgramModule = {
  program_id: string;
  module_id: string;
  sort_order: number;
};

export type ProgramModuleEntry = Module & {
  sort_order: number;
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

export type ModuleResourceType = "video" | "pdf" | "powerpoint" | "youtube";

export type ModuleResource = {
  id: string;
  module_id: string;
  title: string;
  resource_type: ModuleResourceType;
  storage_path: string | null;
  file_name: string | null;
  external_url: string | null;
  sort_order: number;
  created_at: string;
};

export type ModuleResourceWithUrl = ModuleResource & {
  url: string | null;
};
