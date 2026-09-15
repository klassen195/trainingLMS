import { notFound, redirect } from "next/navigation";
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
  comparePractitionersByName,
  parseProfessionalServicePractitioners,
  parseProfessionalServiceProviders,
  parseProfessionalServiceReviews,
  sanitizeReviewForViewer,
} from "@/lib/professional-services-types";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { ProfessionalServicesDatabaseSetup } from "@/components/ProfessionalServicesDatabaseSetup";
import { ProfessionalServiceProviderDetail } from "@/components/ProfessionalServiceProviderDetail";

export default async function ProfessionalServiceProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const auth = await getAuthContext();
  if (auth.kind === "unauthenticated") redirect("/login");
  if (auth.kind === "missing_tables") return <DatabaseSetup />;
  if (auth.kind === "missing_profile") return <MissingProfileSetup userId={auth.userId} />;
  const profile = await requireCapability("access_professional_services");

  const { providerId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(providerId)) notFound();

  const supabase = await createSupabaseServerClient();
  const [providerRes, practitionersRes, reviewsRes] = await Promise.all([
    supabase
      .from("professional_service_providers")
      .select(PROFESSIONAL_SERVICE_PROVIDER_SELECT)
      .eq("id", providerId)
      .maybeSingle(),
    supabase
      .from("professional_service_practitioners")
      .select(PROFESSIONAL_SERVICE_PRACTITIONER_SELECT)
      .eq("provider_id", providerId)
      .order("name", { ascending: true }),
    supabase
      .from("professional_service_reviews")
      .select(PROFESSIONAL_SERVICE_REVIEW_SELECT)
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false }),
  ]);

  if (providerRes.error) {
    if (isMissingProfessionalServicesTable(providerRes.error)) {
      return <ProfessionalServicesDatabaseSetup />;
    }
    throw new Error(supabaseErrorMessage(providerRes.error));
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
  if (!providerRes.data) notFound();

  const provider = parseProfessionalServiceProviders([providerRes.data])[0];
  if (!provider) notFound();
  const practitioners = parseProfessionalServicePractitioners(practitionersRes.data).sort(
    comparePractitionersByName
  );
  const reviews = parseProfessionalServiceReviews(reviewsRes.data).map((review) =>
    sanitizeReviewForViewer(review, profile.id, Boolean(profile.is_admin))
  );

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Handshake className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">{provider.name}</h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Contact details and member recommendations for this provider.
        </p>
      </div>

      <ProfessionalServiceProviderDetail
        provider={provider}
        practitioners={practitioners}
        reviews={reviews}
        currentUserId={profile.id}
        isAdmin={Boolean(profile.is_admin)}
      />
    </div>
  );
}
