export function progressPercent(moduleCount: number, completedCount: number) {
  if (moduleCount === 0) return 0;
  return Math.round((completedCount / moduleCount) * 100);
}

export function programProgressStatus(pct: number) {
  if (pct >= 100) return "completed" as const;
  if (pct > 0) return "in_progress" as const;
  return "not_started" as const;
}
