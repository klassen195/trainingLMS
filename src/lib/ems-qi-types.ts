export type EmsQiFieldType = "text" | "textarea" | "date" | "select" | "scored_select";

export type EmsQiFieldOption = {
  label: string;
  value: string;
  score?: number;
};

export type EmsQiField = {
  id: string;
  label: string;
  type: EmsQiFieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: EmsQiFieldOption[];
  /** How select fields render. Defaults to radio buttons. */
  displayAs?: "radio" | "dropdown";
  includeInSummary?: boolean;
  summaryLabel?: string;
};

export type EmsQiSection = {
  id: string;
  title: string;
  description?: string;
  /** When set, fields after the gate question are hidden unless the gate answer matches. */
  gate?: {
    fieldId: string;
    requiredValue: string;
  };
  fields: EmsQiField[];
};

export type EmsQiAnswers = Record<string, string>;

export type EmsQiReview = {
  id: string;
  reviewer_id: string;
  call_date: string | null;
  call_number: string | null;
  unit: string | null;
  answers: EmsQiAnswers;
  summary_text: string;
  total_score: number | null;
  max_score: number | null;
  created_at: string;
  updated_at: string;
};

export type EmsQiScoreTotals = {
  totalScore: number;
  maxScore: number;
};
