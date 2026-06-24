"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateQuizSettings } from "@/app/actions";
import type { QuestionBankItemWithOptions } from "@/lib/training-lms-types";
import { QuizQuestionBankManager } from "@/components/QuizQuestionBankManager";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function QuizConfigEditor({
  resourceId,
  resourceTitle,
  questionsPerAttempt,
  passPercent,
  bankQuestions,
}: {
  resourceId: string;
  resourceTitle: string;
  questionsPerAttempt: number;
  passPercent: number;
  bankQuestions: QuestionBankItemWithOptions[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [perAttempt, setPerAttempt] = useState(String(questionsPerAttempt));
  const [pass, setPass] = useState(String(passPercent));

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
            Each attempt randomly selects up to {perAttempt || "?"} question(s) from this quiz&apos;s bank (
            {bankQuestions.length} available). Learners need {pass || "?"}% to pass.
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

      <QuizQuestionBankManager resourceId={resourceId} questions={bankQuestions} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
