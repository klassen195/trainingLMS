export type UserRole = "admin" | "instructor" | "learner";

export type ProgramCategory = "fire" | "engineer" | "officer" | "battalion_chief" | "ems" | "administration";

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

export type ModuleResourceType = "video" | "pdf" | "powerpoint" | "youtube" | "quiz";

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
