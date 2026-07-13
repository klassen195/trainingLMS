import { EMS_QI_FORM_SECTIONS, isEmsQiFieldActive } from "@/lib/ems-qi-form-definition";
import type { EmsQiAnswers, EmsQiField, EmsQiScoreTotals } from "@/lib/ems-qi-types";

const CALL_INFO_FIELD_IDS = new Set([
  "call_date",
  "call_number",
  "lead_provider",
  "lead_provider_certification",
  "call_type",
  "crew",
]);
const STRENGTHS_FIELD_ID = "strengths";
const OPPORTUNITIES_FIELD_ID = "opportunities";
const ADDITIONAL_NOTES_FIELD_ID = "additional_notes";

function allFields() {
  return EMS_QI_FORM_SECTIONS.flatMap((section) => section.fields);
}

export function getFieldById(fieldId: string): EmsQiField | undefined {
  return allFields().find((field) => field.id === fieldId);
}

export function getOptionLabel(field: EmsQiField, value: string): string {
  const option = field.options?.find((item) => item.value === value);
  return option?.label ?? value;
}

export function getOptionScore(field: EmsQiField, value: string): number | null {
  if (field.type !== "scored_select" || !value) return null;
  const option = field.options?.find((item) => item.value === value);
  return option?.score ?? null;
}

export function getMaxFieldScore(field: EmsQiField): number {
  if (field.type !== "scored_select" || !field.options?.length) return 0;
  return Math.max(...field.options.map((option) => option.score ?? 0));
}

export function isFullScore(field: EmsQiField, value: string): boolean {
  const score = getOptionScore(field, value);
  const maxScore = getMaxFieldScore(field);
  return score != null && maxScore > 0 && score === maxScore;
}

export function shouldIncludeInScoreSummary(field: EmsQiField, value: string): boolean {
  if (field.type !== "scored_select" || !value || value === "na") return false;
  return getMaxFieldScore(field) > 0;
}

export function calculateEmsQiScores(answers: EmsQiAnswers): EmsQiScoreTotals {
  let totalScore = 0;
  let maxScore = 0;

  for (const field of allFields()) {
    if (field.type !== "scored_select" || !field.options?.length) continue;

    const section = EMS_QI_FORM_SECTIONS.find((item) => item.fields.some((entry) => entry.id === field.id));
    if (section && !isEmsQiFieldActive(section, field, answers)) continue;

    const maxFieldScore = getMaxFieldScore(field);
    if (maxFieldScore <= 0) continue;

    const selected = answers[field.id];
    if (!selected || selected === "na") continue;

    maxScore += maxFieldScore;

    const option = field.options.find((item) => item.value === selected);
    if (option?.score != null) {
      totalScore += option.score;
    }
  }

  return { totalScore, maxScore };
}

function formatImprovementLine(field: EmsQiField, value: string): string {
  const label = field.summaryLabel ?? field.label;
  const optionLabel = getOptionLabel(field, value);
  const score = getOptionScore(field, value);
  const maxFieldScore = getMaxFieldScore(field);

  if (score != null && maxFieldScore > 0) {
    return `${label}: ${optionLabel} (${score}/${maxFieldScore})`;
  }

  return `${label}: ${optionLabel}`;
}

function appendNarrativeBlock(lines: string[], content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  if (lines.length > 0) lines.push("");
  lines.push(trimmed);
}

function buildCallInfoLines(answers: EmsQiAnswers): string[] {
  const lines: string[] = [];

  for (const field of allFields()) {
    if (!CALL_INFO_FIELD_IDS.has(field.id)) continue;
    const value = answers[field.id]?.trim();
    if (!value) continue;
    lines.push(`${field.label}: ${value}`);
  }

  return lines;
}

function buildNeedsImprovementLines(answers: EmsQiAnswers): string[] {
  const needsImprovement: string[] = [];

  for (const section of EMS_QI_FORM_SECTIONS) {
    for (const field of section.fields) {
      if (!isEmsQiFieldActive(section, field, answers)) continue;

      const value = answers[field.id]?.trim();
      if (!shouldIncludeInScoreSummary(field, value ?? "")) continue;
      if (isFullScore(field, value!)) continue;

      needsImprovement.push(`- ${formatImprovementLine(field, value!)}`);
    }
  }

  return needsImprovement;
}

export function buildEmsQiSummary(answers: EmsQiAnswers): string {
  const lines: string[] = ["EMS Call QA/QI Review", ""];

  const callInfoLines = buildCallInfoLines(answers);
  if (callInfoLines.length > 0) {
    lines.push(...callInfoLines, "");
  }

  const { totalScore, maxScore } = calculateEmsQiScores(answers);
  if (maxScore > 0) {
    lines.push(`Total Score: ${totalScore}/${maxScore}`, "");
  }

  const strengths = answers[STRENGTHS_FIELD_ID]?.trim();
  if (strengths) {
    lines.push("Strengths:", strengths, "");
  }

  const needsImprovement = buildNeedsImprovementLines(answers);
  lines.push("Points That Need Improvement:");
  if (needsImprovement.length > 0) {
    lines.push(...needsImprovement);
  } else {
    lines.push("None identified.");
  }
  appendNarrativeBlock(lines, answers[OPPORTUNITIES_FIELD_ID] ?? "");

  const additionalNotes = answers[ADDITIONAL_NOTES_FIELD_ID]?.trim();
  if (additionalNotes) {
    lines.push("", "Additional Notes:", additionalNotes);
  }

  return lines.join("\n").trim();
}
