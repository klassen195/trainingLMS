"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startQuizAttempt, submitQuizAttempt } from "@/app/actions";
import type { QuizAttempt, QuizQuestionForAttempt } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function QuizTaker({
  programId,
  moduleId,
  resourceId,
  resourceTitle,
  enrolled,
  settings,
  activeAttempt,
  latestAttempt,
  questions,
}: {
  programId: string;
  moduleId: string;
  resourceId: string;
  resourceTitle: string;
  enrolled: boolean;
  settings: { questionsPerAttempt: number; passPercent: number; poolSize: number };
  activeAttempt: QuizAttempt | null;
  latestAttempt: QuizAttempt | null;
  questions: QuizQuestionForAttempt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    scorePercent: number;
    passed: boolean;
    correctCount: number;
    total: number;
  } | null>(null);

  const attemptId = activeAttempt?.id ?? null;
  const inProgress = Boolean(attemptId && questions.length > 0 && !result);

  function selectAnswer(questionId: string, optionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  }

  if (!enrolled) {
    return <p className="text-sm text-muted-foreground">Enroll in this module to take the quiz.</p>;
  }

  if (settings.poolSize === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This quiz has not been configured yet. An admin needs to add questions to the pool.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{resourceTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {settings.questionsPerAttempt} random question(s) per attempt · {settings.passPercent}% required to pass
        </p>
      </div>

      {latestAttempt && !inProgress && !result ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">
              Last attempt: <strong>{latestAttempt.score_percent}%</strong>{" "}
              {latestAttempt.passed ? (
                <span className="text-green-500">Passed</span>
              ) : (
                <span className="text-muted-foreground">Not passed</span>
              )}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{result.passed ? "Quiz passed" : "Quiz not passed"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold">{result.scorePercent}%</p>
            <p className="text-sm text-muted-foreground">
              {result.correctCount} of {result.total} correct
            </p>
            {result.passed ? (
              <p className="text-sm text-green-500">This resource has been marked complete.</p>
            ) : (
              <Button
                disabled={pending}
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  startTransition(async () => {
                    setError(null);
                    try {
                      await startQuizAttempt({ programId, moduleId, resourceId });
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to start quiz");
                    }
                  });
                }}
              >
                Try again
              </Button>
            )}
          </CardContent>
        </Card>
      ) : inProgress ? (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {index + 1}. {question.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={answers[question.id] === option.id}
                      onChange={() => selectAnswer(question.id, option.id)}
                    />
                    <span className="text-sm">{option.option_text}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          ))}
          <Button
            disabled={pending || questions.some((q) => !answers[q.id])}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  const submission = await submitQuizAttempt({
                    programId,
                    moduleId,
                    resourceId,
                    attemptId: attemptId!,
                    answers: questions.map((q) => ({
                      questionId: q.id,
                      selectedOptionId: answers[q.id],
                    })),
                  });
                  setResult(submission);
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to submit quiz");
                }
              })
            }
          >
            {pending ? "Submitting..." : "Submit quiz"}
          </Button>
        </div>
      ) : (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await startQuizAttempt({ programId, moduleId, resourceId });
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to start quiz");
              }
            })
          }
        >
          {pending ? "Starting..." : latestAttempt?.passed ? "Retake quiz" : "Start quiz"}
        </Button>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
