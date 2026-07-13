"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Copy, CircleHelp, Eraser, RefreshCw } from "lucide-react";
import { EMS_QI_FORM_SECTIONS, isEmsQiFieldActive } from "@/lib/ems-qi-form-definition";
import { buildEmsQiSummary, calculateEmsQiScores } from "@/lib/ems-qi-summary";
import type { EmsQiAnswers, EmsQiField } from "@/lib/ems-qi-types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

function emptyAnswers(): EmsQiAnswers {
  const answers: EmsQiAnswers = {};
  for (const section of EMS_QI_FORM_SECTIONS) {
    for (const field of section.fields) {
      answers[field.id] = "";
    }
  }
  return answers;
}

function isRadioSelectField(field: EmsQiField) {
  return (field.type === "select" || field.type === "scored_select") && field.displayAs !== "dropdown";
}

function optionLabel(field: EmsQiField, option: NonNullable<EmsQiField["options"]>[number]) {
  if (field.type === "scored_select" && option.score != null) {
    return `${option.label} (${option.score})`;
  }
  return option.label;
}

function OptionRadioGroup({
  field,
  value,
  onChange,
}: {
  field: EmsQiField;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = field.options ?? [];
  const horizontal = options.length <= 4;

  return (
    <fieldset>
      <legend className="sr-only">{field.label}</legend>
      <div className={cn("flex gap-2", horizontal ? "flex-row flex-wrap" : "flex-col")}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                horizontal && options.length <= 2 && "min-w-[6rem] flex-1 justify-center",
                horizontal && options.length > 2 && "flex-1 justify-center",
                selected && "border-primary bg-primary/5 ring-1 ring-primary"
              )}
            >
              <input
                type="radio"
                name={field.id}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-foreground">{optionLabel(field, option)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: EmsQiField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        id={field.id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        rows={4}
      />
    );
  }

  if (field.type === "select" || field.type === "scored_select") {
    if (field.displayAs === "dropdown") {
      return (
        <Select id={field.id} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {optionLabel(field, option)}
            </option>
          ))}
        </Select>
      );
    }
    return <OptionRadioGroup field={field} value={value} onChange={onChange} />;
  }

  return (
    <Input
      id={field.id}
      type={field.type === "date" ? "date" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export function EmsQiReviewForm() {
  const [answers, setAnswers] = useState<EmsQiAnswers>(emptyAnswers);
  const [summaryText, setSummaryText] = useState("");
  const [summaryEdited, setSummaryEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSummary = useMemo(() => buildEmsQiSummary(answers), [answers]);
  const scores = useMemo(() => calculateEmsQiScores(answers), [answers]);

  useEffect(() => {
    if (!summaryEdited) {
      setSummaryText(autoSummary);
    }
  }, [autoSummary, summaryEdited]);

  function updateAnswer(fieldId: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [fieldId]: value };

      for (const section of EMS_QI_FORM_SECTIONS) {
        if (section.gate?.fieldId !== fieldId || value === section.gate.requiredValue) continue;
        for (const field of section.fields) {
          if (field.id !== fieldId) {
            next[field.id] = "";
          }
        }
      }

      return next;
    });
  }

  function regenerateSummary() {
    setSummaryEdited(false);
    setSummaryText(autoSummary);
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setError(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  function clearForm() {
    setAnswers(emptyAnswers());
    setSummaryEdited(false);
    setSummaryText(buildEmsQiSummary(emptyAnswers()));
    setCopied(false);
    setError(null);
  }

  return (
    <div className="space-y-8">
      {EMS_QI_FORM_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="text-xl">{section.title}</CardTitle>
            {section.description ? <CardDescription>{section.description}</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-5">
            {section.fields.map((field) => {
              if (!isEmsQiFieldActive(section, field, answers)) return null;

              return (
                <div
                  key={field.id}
                  className={cn(
                    "space-y-2",
                    isRadioSelectField(field) &&
                      "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  )}
                >
                  <FieldLabel
                    htmlFor={field.id}
                    className={cn(
                      "text-base font-medium text-foreground leading-snug",
                      isRadioSelectField(field) && "sm:mb-0 sm:max-w-[45%] sm:shrink-0",
                      field.helpText && "inline-flex items-start gap-1.5"
                    )}
                  >
                    <span>{field.label}</span>
                    {field.helpText ? (
                      <span
                        tabIndex={0}
                        className="group relative inline-flex shrink-0 rounded-sm pt-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={field.helpText}
                      >
                        <CircleHelp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-normal leading-snug text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                        >
                          {field.helpText}
                        </span>
                      </span>
                    ) : null}
                  </FieldLabel>
                  <div className={cn(isRadioSelectField(field) && "sm:min-w-0 sm:flex-1")}>
                    <FieldInput
                      field={field}
                      value={answers[field.id] ?? ""}
                      onChange={(value) => updateAnswer(field.id, value)}
                    />
                  </div>
                  {field.hint ? <FieldHint className="sm:col-span-2">{field.hint}</FieldHint> : null}
                </div>
              );
            })}
            {section.gate && answers[section.gate.fieldId] === "no" ? (
              <p className="text-sm text-muted-foreground">Remaining items in this section are skipped.</p>
            ) : null}
            {section.gate && !answers[section.gate.fieldId] ? (
              <p className="text-sm text-muted-foreground">Answer the qualifying question to continue this section.</p>
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Export Summary
              </CardTitle>
              <CardDescription>
                Auto-generated with Points That Need Improvement from your scored answers. Edit if needed, then copy into
                your other program.
              </CardDescription>
            </div>
            {scores.maxScore > 0 ? (
              <div className="rounded-md border bg-muted/50 px-4 py-2 text-sm font-medium">
                Score: {scores.totalScore}/{scores.maxScore}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={summaryText}
            onChange={(event) => {
              setSummaryEdited(true);
              setSummaryText(event.target.value);
            }}
            rows={14}
            className="font-mono text-sm"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copySummary}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copied!" : "Copy summary"}
            </Button>
            <Button type="button" variant="outline" onClick={regenerateSummary}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate from answers
            </Button>
            <Button type="button" variant="ghost" onClick={clearForm}>
              <Eraser className="mr-2 h-4 w-4" />
              Clear form
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
