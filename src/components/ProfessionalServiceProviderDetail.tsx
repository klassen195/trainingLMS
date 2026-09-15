"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Globe,
  UserRound,
} from "lucide-react";
import {
  deleteProfessionalServicePractitioner,
  deleteProfessionalServiceProvider,
  deleteProfessionalServiceReview,
  setProfessionalServicePractitionerHidden,
  setProfessionalServiceProviderHidden,
} from "@/app/professional-services/actions";
import { formatDate } from "@/lib/dates";
import { formatPhoneNumber, phoneDigits } from "@/lib/phone";
import type {
  ProfessionalServicePractitioner,
  ProfessionalServiceProvider,
  ProfessionalServiceReview,
} from "@/lib/professional-services-types";
import {
  categoryLabel,
  findReviewForTarget,
  orgReviews,
  practitionerReviews,
  reviewAuthorLabel,
  tallyReviews,
} from "@/lib/professional-services-types";
import { ProfessionalServicePractitionerForm } from "@/components/ProfessionalServicePractitionerForm";
import { ProfessionalServiceProviderForm } from "@/components/ProfessionalServiceProviderForm";
import { ProfessionalServiceReviewForm } from "@/components/ProfessionalServiceReviewForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";

function TallyRow({
  recommend,
  recommendAgainst,
}: {
  recommend: number;
  recommendAgainst: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          recommend > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        {recommend} recommend
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          recommendAgainst > 0 ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        {recommendAgainst} against
      </span>
    </div>
  );
}

export function ProfessionalServiceProviderDetail({
  provider,
  practitioners,
  reviews,
  currentUserId,
  isAdmin,
}: {
  provider: ProfessionalServiceProvider;
  practitioners: ProfessionalServicePractitioner[];
  reviews: ProfessionalServiceReview[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ProfessionalServicePractitioner | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const practiceReviews = useMemo(() => orgReviews(reviews), [reviews]);
  const practiceTallies = useMemo(() => tallyReviews(practiceReviews), [practiceReviews]);
  const hasAnyMine = reviews.some((review) => review.created_by === currentUserId);
  const canEditProvider = isAdmin || provider.created_by === currentUserId;

  function openReview(practitionerId: string | null = null) {
    setReviewTargetId(practitionerId);
    setReviewOpen(true);
  }

  async function onDeleteProvider() {
    if (!window.confirm(`Delete ${provider.name}? This also removes people and reviews.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProfessionalServiceProvider({ id: provider.id });
      router.push("/professional-services");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete provider");
      setBusy(false);
    }
  }

  async function onToggleHidden() {
    setBusy(true);
    setError(null);
    try {
      await setProfessionalServiceProviderHidden({
        id: provider.id,
        isHidden: !provider.is_hidden,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update visibility");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteReview(review: ProfessionalServiceReview) {
    if (!window.confirm("Delete this review?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProfessionalServiceReview({ id: review.id, providerId: provider.id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete review");
    } finally {
      setBusy(false);
    }
  }

  async function onDeletePerson(person: ProfessionalServicePractitioner) {
    if (!window.confirm(`Remove ${person.name}? Their reviews will be deleted.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProfessionalServicePractitioner({ id: person.id, providerId: provider.id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete person");
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePersonHidden(person: ProfessionalServicePractitioner) {
    setBusy(true);
    setError(null);
    try {
      await setProfessionalServicePractitionerHidden({
        id: person.id,
        providerId: provider.id,
        isHidden: !person.is_hidden,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update visibility");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/professional-services">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Directory
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {canEditProvider ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
          {isAdmin ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onToggleHidden}>
              {provider.is_hidden ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Unhide
                </>
              ) : (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide
                </>
              )}
            </Button>
          ) : null}
          {canEditProvider ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={onDeleteProvider}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{categoryLabel(provider.category)}</Badge>
                {provider.is_hidden ? <Badge variant="outline">Hidden</Badge> : null}
              </div>
              {provider.specialty ? (
                <p className="text-muted-foreground">{provider.specialty}</p>
              ) : null}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Practice reviews
                </p>
                <TallyRow
                  recommend={practiceTallies.recommend}
                  recommendAgainst={practiceTallies.recommend_against}
                />
              </div>
            </CardHeader>
            {provider.notes ? (
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{provider.notes}</p>
              </CardContent>
            ) : null}
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-lg">People at this practice</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingPerson(null);
                  setPersonOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add person
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {practitioners.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No people listed yet. Add masseuses, doctors, or other individuals here.
                </p>
              ) : (
                practitioners.map((person) => {
                  const tallies = tallyReviews(practitionerReviews(reviews, person.id));
                  const canEditPerson = isAdmin || person.created_by === currentUserId;
                  return (
                    <div key={person.id} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{person.name}</span>
                            {person.is_hidden ? <Badge variant="outline">Hidden</Badge> : null}
                          </div>
                          {person.role_title ? (
                            <p className="text-sm text-muted-foreground">{person.role_title}</p>
                          ) : null}
                          {person.notes ? (
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                              {person.notes}
                            </p>
                          ) : null}
                          <TallyRow
                            recommend={tallies.recommend}
                            recommendAgainst={tallies.recommend_against}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openReview(person.id)}
                          >
                            {findReviewForTarget(reviews, currentUserId, person.id)
                              ? "Update review"
                              : "Review"}
                          </Button>
                          {canEditPerson ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingPerson(person);
                                setPersonOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          ) : null}
                          {isAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => onTogglePersonHidden(person)}
                            >
                              {person.is_hidden ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {person.is_hidden ? "Unhide" : "Hide"}
                              </span>
                            </Button>
                          ) : null}
                          {canEditPerson ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => onDeletePerson(person)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-lg">Reviews</CardTitle>
              <Button type="button" size="sm" onClick={() => openReview(null)}>
                {hasAnyMine ? "Leave or update a review" : "Leave a review"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet. Be the first.</p>
              ) : (
                reviews.map((review) => {
                  const canDelete = isAdmin || review.created_by === currentUserId;
                  const about = review.practitioner_id
                    ? `About ${review.practitioner?.name ?? "person"}`
                    : `About ${provider.name}`;
                  return (
                    <div key={review.id} className="rounded-md border p-4">
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={review.verdict === "recommend" ? "default" : "destructive"}
                            >
                              {review.verdict === "recommend" ? "Recommend" : "Recommend against"}
                            </Badge>
                            <Badge variant="outline">{about}</Badge>
                            <span className="text-sm font-medium">
                              {reviewAuthorLabel(review, { revealAnonymous: isAdmin })}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(review.created_at)}
                            {review.service_date
                              ? ` · Service ${formatDate(review.service_date)}`
                              : ""}
                            {review.used_for ? ` · Used for ${review.used_for}` : ""}
                          </p>
                        </div>
                        {canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => onDeleteReview(review)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete review</span>
                          </Button>
                        ) : null}
                      </div>
                      {review.body ? (
                        <p className="whitespace-pre-wrap text-sm">{review.body}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(provider.city || provider.address) && (
              <div className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  {provider.address ? <p>{provider.address}</p> : null}
                  {provider.city ? <p className="text-muted-foreground">{provider.city}</p> : null}
                </div>
              </div>
            )}
            {provider.phone ? (
              <a
                href={`tel:${phoneDigits(provider.phone)}`}
                className="flex items-center gap-2 hover:underline"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                {formatPhoneNumber(provider.phone)}
              </a>
            ) : null}
            {provider.email ? (
              <a href={`mailto:${provider.email}`} className="flex items-center gap-2 hover:underline">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {provider.email}
              </a>
            ) : null}
            {provider.website ? (
              <a
                href={provider.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 break-all hover:underline"
              >
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                {provider.website.replace(/^https?:\/\//i, "")}
              </a>
            ) : null}
            {!provider.phone &&
            !provider.email &&
            !provider.website &&
            !provider.city &&
            !provider.address ? (
              <p className="text-muted-foreground">No contact details yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit provider</SheetTitle>
            <SheetDescription>Update listing details and contact info.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ProfessionalServiceProviderForm
              provider={provider}
              onDone={() => setEditOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={personOpen}
        onOpenChange={(open) => {
          setPersonOpen(open);
          if (!open) setEditingPerson(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingPerson ? "Edit person" : "Add person"}</SheetTitle>
            <SheetDescription>
              Recommend individuals who work at {provider.name}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ProfessionalServicePractitionerForm
              providerId={provider.id}
              practitioner={editingPerson}
              onDone={() => {
                setPersonOpen(false);
                setEditingPerson(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Leave a review</SheetTitle>
            <SheetDescription>
              Recommend the practice or a specific person. You can post anonymously.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ProfessionalServiceReviewForm
              key={reviewTargetId ?? "practice"}
              providerId={provider.id}
              providerName={provider.name}
              practitioners={practitioners}
              reviews={reviews}
              currentUserId={currentUserId}
              initialPractitionerId={reviewTargetId}
              onDone={() => setReviewOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
