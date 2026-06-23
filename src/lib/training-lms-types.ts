export type UserRole = "admin" | "instructor" | "learner";

export type CourseCategory = "fire" | "engineer" | "officer" | "battalion_chief" | "ems";

export type CourseStatus = "draft" | "published" | "archived";

export type EnrollmentStatus = "active" | "completed";

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  rank: string | null;
  role: UserRole;
  created_at: string;
};

export type Course = {
  id: string;
  title: string;
  description: string | null;
  category: CourseCategory;
  status: CourseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  course_id: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
};

export type Assignment = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
};

export type Enrollment = {
  id: string;
  course_id: string;
  user_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
};

export type LessonProgress = {
  id: string;
  lesson_id: string;
  user_id: string;
  completed_at: string;
};

export type AssignmentSubmission = {
  id: string;
  assignment_id: string;
  user_id: string;
  content: string;
  submitted_at: string;
};
