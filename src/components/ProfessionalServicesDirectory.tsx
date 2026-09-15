"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, ThumbsDown, ThumbsUp, UserRound } from "lucide-react";
import type {
  ProfessionalServiceCategory,
  ProfessionalServiceProvider,
  ProfessionalServiceReviewTallies,
} from "@/lib/professional-services-types";
import {
  PROFESSIONAL_SERVICE_CATEGORIES,
  PROFESSIONAL_SERVICE_CATEGORY_LABELS,
  categoryLabel,
} from "@/lib/professional-services-types";
import { formatPhoneNumber } from "@/lib/phone";
import { ProfessionalServiceProviderForm } from "@/components/ProfessionalServiceProviderForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";

const emptyTallies: ProfessionalServiceReviewTallies = {
  recommend: 0,
  recommend_against: 0,
  total: 0,
};

export function ProfessionalServicesDirectory({
  providers,
  talliesByProviderId,
  peopleCountByProviderId,
}: {
  providers: ProfessionalServiceProvider[];
  talliesByProviderId: Record<string, ProfessionalServiceReviewTallies>;
  peopleCountByProviderId: Record<string, number>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProfessionalServiceCategory | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers.filter((provider) => {
      if (category !== "all" && provider.category !== category) return false;
      if (!q) return true;
      const haystack = [
        provider.name,
        provider.specialty,
        provider.city,
        provider.address,
        provider.notes,
        categoryLabel(provider.category),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [providers, query, category]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, city, specialty…"
              className="pl-9"
              aria-label="Search providers"
            />
          </div>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProfessionalServiceCategory | "all")}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {PROFESSIONAL_SERVICE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {PROFESSIONAL_SERVICE_CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add provider
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {providers.length === 0
              ? "No providers yet. Add the first recommendation for the crew."
              : "No providers match your search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((provider) => {
            const tallies = talliesByProviderId[provider.id] ?? emptyTallies;
            const peopleCount = peopleCountByProviderId[provider.id] ?? 0;
            return (
              <Link key={provider.id} href={`/professional-services/${provider.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{categoryLabel(provider.category)}</Badge>
                      {provider.is_hidden ? <Badge variant="outline">Hidden</Badge> : null}
                    </div>
                    <CardTitle className="text-xl leading-snug">{provider.name}</CardTitle>
                    {provider.specialty ? (
                      <p className="text-sm text-muted-foreground">{provider.specialty}</p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {provider.city ? (
                      <p className="text-sm text-muted-foreground">{provider.city}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          tallies.recommend > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                        )}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {tallies.recommend} recommend
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          tallies.recommend_against > 0
                            ? "text-red-700 dark:text-red-300"
                            : "text-muted-foreground"
                        )}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        {tallies.recommend_against} against
                      </span>
                    </div>
                    {peopleCount > 0 ? (
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5" />
                        {peopleCount} {peopleCount === 1 ? "person" : "people"}
                      </p>
                    ) : null}
                    {(provider.phone || provider.website) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          provider.phone ? formatPhoneNumber(provider.phone, "") : "",
                          provider.website,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add provider</SheetTitle>
            <SheetDescription>
              Create a directory listing so others can leave recommendations.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ProfessionalServiceProviderForm
              onDone={(providerId) => {
                setSheetOpen(false);
                if (providerId) router.push(`/professional-services/${providerId}`);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
