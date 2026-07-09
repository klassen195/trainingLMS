export function programEnrollmentLabel(
  enrolledCount: number,
  moduleCount: number
): "not_enrolled" | "partially_enrolled" | "fully_enrolled" {
  if (enrolledCount === 0) return "not_enrolled";
  if (moduleCount > 0 && enrolledCount >= moduleCount) return "fully_enrolled";
  return "partially_enrolled";
}

export function programEnrollmentSummary(enrolledCount: number, moduleCount: number): string {
  const status = programEnrollmentLabel(enrolledCount, moduleCount);
  if (status === "not_enrolled") return "Not enrolled";
  if (status === "fully_enrolled") return "Enrolled in all modules";
  return `Partially enrolled (${enrolledCount} of ${moduleCount} modules)`;
}
