import { redirect } from "next/navigation";
import { Handshake } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingProfessionalServicesTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import {
  PROFESSIONAL_SERVICE_PRACTITIONER_SELECT,
  PROFESSIONAL_SERVICE_PROVIDER_SELECT,
  PROFESSIONAL_SERVICE_REVIEW_SELECT,
  compareProvidersByName,
  orgReviews,
  parseProfessionalServicePractitioners,
  parseProfessionalServiceProviders,
  parseProfessionalServiceReviews,
  tallyReviews,
} from "@/lib/professional-services-types";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { ProfessionalServicesDatabaseSetup } from "@/components/ProfessionalServicesDatabaseSetup";
import { ProfessionalServicesDirectory } from "@/components/ProfessionalServicesDirectory";

export default async function ProfessionalServicesPage() {
  const auth = await getAuthContext();
  if (auth.kind === "unauthenticated") redirect("/login");
  if (auth.kind === "missing_tables") return <DatabaseSetup />;
  if (auth.kind === "missing_profile") return <MissingProfileSetup userId={auth.userId} />;
  const profile = await requireCapability("access_professional_services");

  const supabase = await createSupabaseServerClient();
  const [providersRes, practitionersRes, reviewsRes] = await Promise.all([
    supabase
      .from("professional_service_providers")
      .select(PROFESSIONAL_SERVICE_PROVIDER_SELECT)
      .order("name", { ascending: true }),
    supabase
      .from("professional_service_practitioners")
      .select(PROFESSIONAL_SERVICE_PRACTITIONER_SELECT),
    supabase.from("professional_service_reviews").select(PROFESSIONAL_SERVICE_REVIEW_SELECT),
  ]);

  if (providersRes.error) {
    if (isMissingProfessionalServicesTable(providersRes.error)) {
      return <ProfessionalServicesDatabaseSetup />;
    }
    throw new Error(supabaseErrorMessage(providersRes.error));
  }
  if (practitionersRes.error) {
    if (isMissingProfessionalServicesTable(practitionersRes.error)) {
      return <ProfessionalServicesDatabaseSetup />;
    }
    throw new Error(supabaseErrorMessage(practitionersRes.error));
  }
  if (reviewsRes.error) {
    if (isMissingProfessionalServicesTable(reviewsRes.error)) {
      return <ProfessionalServicesDatabaseSetup />;
    }
    throw new Error(supabaseErrorMessage(reviewsRes.error));
  }

  const providers = parseProfessionalServiceProviders(providersRes.data).sort(compareProvidersByName);
  const practitioners = parseProfessionalServicePractitioners(practitionersRes.data);
  const reviews = parseProfessionalServiceReviews(reviewsRes.data);

  const talliesByProviderId: Record<string, ReturnType<typeof tallyReviews>> = {};
  for (const review of orgReviews(reviews)) {
    const current = talliesByProviderId[review.provider_id] ?? {
      recommend: 0,
      recommend_against: 0,
      total: 0,
    };
    if (review.verdict === "recommend") current.recommend += 1;
    else current.recommend_against += 1;
    current.total += 1;
    talliesByProviderId[review.provider_id] = current;
  }

  const peopleCountByProviderId: Record<string, number> = {};
  for (const person of practitioners) {
    peopleCountByProviderId[person.provider_id] =
      (peopleCountByProviderId[person.provider_id] ?? 0) + 1;
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Handshake className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Professional Services</h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Share providers you recommend—or recommend against—so the crew can find trusted doctors,
          mechanics, contractors, and more.
        </p>
      </div>

      <ProfessionalServicesDirectory
        providers={providers}
        talliesByProviderId={talliesByProviderId}
        peopleCountByProviderId={peopleCountByProviderId}
        currentUserId={profile.id}
        isAdmin={Boolean(profile.is_admin)}
      />
    </div>
  );
}
