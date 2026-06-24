"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createQuestionBankItem,
  deleteQuestionBankItem,
  updateQuestionBankItem,
} from "@/app/actions";
import type { QuestionBankItemWithOptions } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type OptionDraft = { text: string; isCorrect: boolean };

const emptyOptions = (): OptionDraft[] => [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function QuestionBankManager({ questions }: { questions: QuestionBankItemWithOptions[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(emptyOptions());

  function resetForm() {
    setEditingId(null);
    setPrompt("");
    setExplanation("");
    setTopic("");
    setOptions(emptyOptions());
    setError(null);
  }

  function loadQuestion(question: QuestionBankItemWithOptions) {
    setEditingId(question.id);
    setPrompt(question.prompt);
    setExplanation(question.explanation ?? "");
    setTopic(question.topic ?? "");
    setOptions(
      question.options.length
        ? question.options.map((o) => ({ text: o.option_text, isCorrect: o.is_correct }))
        : emptyOptions()
    );
    setError(null);
  }

  function setCorrectIndex(index: number) {
    setOptions((current) => current.map((option, i) => ({ ...option, isCorrect: i === index })));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{editingId ? "Edit question" : "New question"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="qb-prompt">Question</FieldLabel>
            <Textarea
              id="qb-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the question prompt"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="qb-topic">Topic (optional)</FieldLabel>
            <Input
              id="qb-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Pump operations"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="qb-explanation">Explanation (optional)</FieldLabel>
            <Textarea
              id="qb-explanation"
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Shown after the quiz is submitted"
            />
          </div>
          <div className="space-y-3">
            <FieldLabel>Answer options</FieldLabel>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  checked={option.isCorrect}
                  onChange={() => setCorrectIndex(index)}
                  className="shrink-0"
                />
                <Input
                  value={option.text}
                  onChange={(e) =>
                    setOptions((current) =>
                      current.map((item, i) => (i === index ? { ...item, text: e.target.value } : item))
                    )
                  }
                  placeholder={`Option ${index + 1}`}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Select the radio button for the correct answer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || !prompt.trim()}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  try {
                    if (editingId) {
                      await updateQuestionBankItem({
                        questionId: editingId,
                        prompt,
                        explanation,
                        topic,
                        options,
                      });
                    } else {
                      await createQuestionBankItem({ prompt, explanation, topic, options });
                    }
                    resetForm();
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to save question");
                  }
                })
              }
            >
              {pending ? "Saving..." : editingId ? "Update question" : "Add to bank"}
            </Button>
            {editingId ? (
              <Button variant="outline" disabled={pending} onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question bank ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions yet. Add your first question.</p>
          ) : (
            questions.map((question) => (
              <div key={question.id} className="rounded-lg border p-4">
                <p className="font-medium">{question.prompt}</p>
                {question.topic ? (
                  <p className="mt-1 text-xs text-muted-foreground">Topic: {question.topic}</p>
                ) : null}
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {question.options.map((option) => (
                    <li key={option.id}>
                      {option.is_correct ? "✓ " : "○ "}
                      {option.option_text}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadQuestion(question)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null);
                        try {
                          await deleteQuestionBankItem(question.id);
                          if (editingId === question.id) resetForm();
                          router.refresh();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to delete question");
                        }
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
