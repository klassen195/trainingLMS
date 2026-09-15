"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertProfessionalServiceReview,
  type ProfessionalServiceReviewInput,
} from "@/app/professional-services/actions";
import type {
  ProfessionalServicePractitioner,
  ProfessionalServiceReview,
  ProfessionalServiceVerdict,
} from "@/lib/professional-services-types";
import { findReviewForTarget } from "@/lib/professional-services-types";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export function ProfessionalServiceReviewForm({
  providerId,
  providerName,
  practitioners,
  reviews,
  currentUserId,
  initialPractitionerId = null,
  onDone,
}: {
  providerId: string;
  providerName: string;
  practitioners: ProfessionalServicePractitioner[];
  reviews: ProfessionalServiceReview[];
  currentUserId: string;
  initialPractitionerId?: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [practitionerId, setPractitionerId] = useState<string | null>(initialPractitionerId);
  const existing = findReviewForTarget(reviews, currentUserId, practitionerId);
  const [verdict, setVerdict] = useState<ProfessionalServiceVerdict>(
    existing?.verdict ?? "recommend"
  );
  const [body, setBody] = useState(existing?.body ?? "");
  const [usedFor, setUsedFor] = useState(existing?.used_for ?? "");
  const [serviceDate, setServiceDate] = useState(existing?.service_date ?? "");
  const [isAnonymous, setIsAnonymous] = useState(existing?.is_anonymous ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = findReviewForTarget(reviews, currentUserId, practitionerId);
    setVerdict(next?.verdict ?? "recommend");
    setBody(next?.body ?? "");
    setUsedFor(next?.used_for ?? "");
    setServiceDate(next?.service_date ?? "");
    setIsAnonymous(next?.is_anonymous ?? false);
  }, [practitionerId, reviews, currentUserId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload: ProfessionalServiceReviewInput = {
      providerId,
      practitionerId,
      verdict,
      isAnonymous,
      body,
      usedFor,
      serviceDate: serviceDate || null,
    };
    try {
      await upsertProfessionalServiceReview(payload);
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-review-target">About</FieldLabel>
        <Select
          id="ps-review-target"
          value={practitionerId ?? ""}
          onChange={(e) => setPractitionerId(e.target.value || null)}
        >
          <option value="">{providerName} (practice)</option>
          {practitioners.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {person.role_title ? ` — ${person.role_title}` : ""}
            </option>
          ))}
        </Select>
        <FieldHint>You can leave one review for the practice and one for each person.</FieldHint>
      </div>

      <div className="grid gap-1.5">
        <FieldLabel>Your verdict</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              verdict === "recommend"
                ? "border-emerald-600 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                : "hover:bg-accent"
            )}
            onClick={() => setVerdict("recommend")}
          >
            Recommend
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              verdict === "recommend_against"
                ? "border-red-600 bg-red-500/15 text-red-800 dark:text-red-200"
                : "hover:bg-accent"
            )}
            onClick={() => setVerdict("recommend_against")}
          >
            Recommend against
          </button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-review-body">Review</FieldLabel>
        <Textarea
          id="ps-review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What should others know?"
          rows={4}
        />
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-used-for">Used for</FieldLabel>
        <Input
          id="ps-used-for"
          value={usedFor}
          onChange={(e) => setUsedFor(e.target.value)}
          placeholder="Knee pain, oil change, remodel…"
        />
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-service-date">Service date</FieldLabel>
        <Input
          id="ps-service-date"
          type="date"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
        />
        <span className="grid gap-1">
          <span>Post anonymously</span>
          <FieldHint>Your name stays hidden from other members.</FieldHint>
        </span>
      </label>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : existing ? "Update review" : "Post review"}
        </Button>
      </div>
    </form>
  );
}
