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
  /** Shown on hover next to the question label. */
  helpText?: string;
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

export type EmsQiScoreTotals = {
  totalScore: number;
  maxScore: number;
};
