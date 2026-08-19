export type ProgramTag =
  | "fire"
  | "engineer"
  | "officer"
  | "battalion_chief"
  | "ems"
  | "administration"
  | "taskbooks"
  | "special_operations";

/** @deprecated Prefer ProgramTag */
export type ProgramCategory = ProgramTag;

export type ProgramStatus = "draft" | "published" | "archived";

export type EnrollmentStatus = "active" | "completed";

export type Profile = {
  id: string;
  client_id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  rank: string | null;
  swing_up?: string[] | null;
  rank_promoted_on?: string | null;
  permission_level_ids: string[];
  permission_levels?: { id: string; name: string }[];
  is_admin: boolean;
  is_active?: boolean;
  invited_at?: string | null;
  created_at: string;
  employee_number?: string | null;
  job_title?: string | null;
  department?: string | null;
  phone?: string | null;
  hire_date?: string | null;
  shift?: "red" | "blue" | "green" | "white" | null;
  home_address?: string | null;
  emergency_contacts?: string | null;
  hr_info?: string | null;
  anniversary?: string | null;
  spouse_name?: string | null;
  spouse_birthday?: string | null;
  kids_birthdays?: string | null;
  primary_location_id?: string | null;
  supervisor_id?: string | null;
  ems_cleared_level_id?: string | null;
};

export type Program = {
  id: string;
  title: string;
  description: string | null;
  tags: ProgramTag[];
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

export type ModuleEnrollment = {
  id: string;
  module_id: string;
  user_id: string;
  enrolled_at: string;
};

export type ResourceProgress = {
  id: string;
  resource_id: string;
  user_id: string;
  completed_at: string;
};

export type ModuleResourceType = "video" | "pdf" | "powerpoint" | "youtube" | "quiz" | "link" | "checklist";

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

export type QuestionBankOption = {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
};

export type QuestionBankItem = {
  id: string;
  resource_id: string;
  prompt: string;
  explanation: string | null;
  topic: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionBankItemWithOptions = QuestionBankItem & {
  options: QuestionBankOption[];
};

export type QuizSettings = {
  resource_id: string;
  questions_per_attempt: number;
  pass_percent: number;
  updated_at: string;
};

export type QuizAttempt = {
  id: string;
  resource_id: string;
  user_id: string;
  score_percent: number | null;
  passed: boolean | null;
  started_at: string;
  completed_at: string | null;
};

export type QuizQuestionForAttempt = {
  id: string;
  prompt: string;
  options: { id: string; option_text: string }[];
};

export type ChecklistItem = {
  id: string;
  resource_id: string;
  label: string;
  sort_order: number;
};

export type ChecklistItemWithProgress = ChecklistItem & {
  completed_at: string | null;
};
