"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQuizPoolQuestions, updateQuizSettings } from "@/app/actions";
import type { QuestionBankItemWithOptions } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function QuizConfigEditor({
  resourceId,
  resourceTitle,
  questionsPerAttempt,
  passPercent,
  poolQuestionIds,
  bankQuestions,
}: {
  resourceId: string;
  resourceTitle: string;
  questionsPerAttempt: number;
  passPercent: number;
  poolQuestionIds: string[];
  bankQuestions: QuestionBankItemWithOptions[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [perAttempt, setPerAttempt] = useState(String(questionsPerAttempt));
  const [pass, setPass] = useState(String(passPercent));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(poolQuestionIds));

  function toggleQuestion(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{resourceTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="quiz-per-attempt">Questions per attempt</FieldLabel>
            <Input
              id="quiz-per-attempt"
              type="number"
              min={1}
              value={perAttempt}
              onChange={(e) => setPerAttempt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="quiz-pass">Pass score (%)</FieldLabel>
            <Input id="quiz-pass" type="number" min={1} max={100} value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            Each attempt randomly selects up to {perAttempt || "?"} question(s) from the pool below (
            {selectedIds.size} selected). Learners need {pass || "?"}% to pass.
          </p>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await updateQuizSettings({
                    resourceId,
                    questionsPerAttempt: Number(perAttempt) || 1,
                    passPercent: Number(pass) || 80,
                  });
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to save settings");
                }
              })
            }
          >
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-lg">Question pool</CardTitle>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await setQuizPoolQuestions({
                    resourceId,
                    questionIds: [...selectedIds],
                  });
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to save pool");
                }
              })
            }
          >
            Save pool
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {bankQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions in the bank yet. Add questions in the Question Bank admin page first.
            </p>
          ) : (
            bankQuestions.map((question) => (
              <label
                key={question.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.has(question.id)}
                  onChange={() => toggleQuestion(question.id)}
                />
                <span>
                  <span className="block font-medium">{question.prompt}</span>
                  {question.topic ? (
                    <span className="mt-1 block text-xs text-muted-foreground">Topic: {question.topic}</span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
