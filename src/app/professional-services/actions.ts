"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertCapability } from "@/lib/capability-access";
import { isIsoDateString } from "@/lib/dates";
import { isAdmin } from "@/lib/permissions";
import { formatPhoneInput } from "@/lib/phone";
import {
  isProfessionalServiceCategory,
  isProfessionalServiceVerdict,
  type ProfessionalServiceCategory,
  type ProfessionalServiceVerdict,
} from "@/lib/professional-services-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingProfessionalServicesTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingProfessionalServicesTable(error)) {
    throw new Error(
      "Database not set up yet. Run the Professional Services migrations in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateProfessionalServices(providerId?: string) {
  revalidatePath("/professional-services");
  if (providerId) revalidatePath(`/professional-services/${providerId}`);
}

function normalizeOptionalText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function parseCategory(value: string): ProfessionalServiceCategory {
  if (!isProfessionalServiceCategory(value)) throw new Error("Choose a category.");
  return value;
}

function parseVerdict(value: string): ProfessionalServiceVerdict {
  if (!isProfessionalServiceVerdict(value)) throw new Error("Choose recommend or recommend against.");
  return value;
}

function parseOptionalServiceDate(value: string | null | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  if (!isIsoDateString(trimmed)) throw new Error("Invalid service date.");
  return trimmed;
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export type ProfessionalServiceProviderInput = {
  name: string;
  category: string;
  specialty: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  address: string;
  notes: string;
};

export type ProfessionalServicePractitionerInput = {
  providerId: string;
  name: string;
  roleTitle: string;
  notes: string;
};

export type ProfessionalServiceReviewInput = {
  providerId: string;
  practitionerId: string | null;
  verdict: string;
  isAnonymous: boolean;
  body: string;
  usedFor: string;
  serviceDate: string | null;
};

function resolvedProviderFields(input: ProfessionalServiceProviderInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  return {
    name,
    category: parseCategory(input.category),
    specialty: normalizeOptionalText(input.specialty),
    phone: formatPhoneInput(normalizeOptionalText(input.phone)),
    email: normalizeOptionalText(input.email),
    website: normalizeWebsite(normalizeOptionalText(input.website)),
    city: normalizeOptionalText(input.city),
    address: normalizeOptionalText(input.address),
    notes: normalizeOptionalText(input.notes),
  };
}

function resolvedPractitionerFields(input: ProfessionalServicePractitionerInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const providerId = input.providerId.trim();
  if (!providerId) throw new Error("Provider is required.");
  return {
    providerId,
    name,
    role_title: normalizeOptionalText(input.roleTitle),
    notes: normalizeOptionalText(input.notes),
  };
}

export async function createProfessionalServiceProvider(input: ProfessionalServiceProviderInput) {
  const profile = await assertCapability("access_professional_services");
  const fields = resolvedProviderFields(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_service_providers")
    .insert({
      client_id: profile.client_id,
      created_by: profile.id,
      ...fields,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  revalidateProfessionalServices(data?.id);
  return data!.id as string;
}

export async function updateProfessionalServiceProvider(
  input: ProfessionalServiceProviderInput & { id: string }
) {
  const profile = await assertCapability("access_professional_services");
  const fields = resolvedProviderFields(input);
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("professional_service_providers")
    .select("id, created_by")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Provider not found.");
  if (existing.created_by !== profile.id && !isAdmin(profile)) {
    throw new Error("You can only edit providers you created.");
  }

  const { error } = await supabase
    .from("professional_service_providers")
    .update(fields)
    .eq("id", input.id);
  throwIfDbError(error);
  revalidateProfessionalServices(input.id);
}

export async function deleteProfessionalServiceProvider(input: { id: string }) {
  const profile = await assertCapability("access_professional_services");
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("professional_service_providers")
    .select("id, created_by")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Provider not found.");
  if (existing.created_by !== profile.id && !isAdmin(profile)) {
    throw new Error("You can only delete providers you created.");
  }

  const { error } = await supabase.from("professional_service_providers").delete().eq("id", input.id);
  throwIfDbError(error);
  revalidateProfessionalServices();
}

export async function setProfessionalServiceProviderHidden(input: {
  id: string;
  isHidden: boolean;
}) {
  const profile = await assertCapability("access_professional_services");
  if (!isAdmin(profile)) throw new Error("Only admins can hide providers.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("professional_service_providers")
    .update({ is_hidden: input.isHidden })
    .eq("id", input.id);
  throwIfDbError(error);
  revalidateProfessionalServices(input.id);
}

export async function createProfessionalServicePractitioner(
  input: ProfessionalServicePractitionerInput
) {
  const profile = await assertCapability("access_professional_services");
  const fields = resolvedPractitionerFields(input);
  const supabase = await createSupabaseServerClient();

  const { data: provider, error: providerError } = await supabase
    .from("professional_service_providers")
    .select("id")
    .eq("id", fields.providerId)
    .maybeSingle();
  throwIfDbError(providerError);
  if (!provider) throw new Error("Provider not found.");

  const { data, error } = await supabase
    .from("professional_service_practitioners")
    .insert({
      client_id: profile.client_id,
      created_by: profile.id,
      provider_id: fields.providerId,
      name: fields.name,
      role_title: fields.role_title,
      notes: fields.notes,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  revalidateProfessionalServices(fields.providerId);
  return data!.id as string;
}

export async function updateProfessionalServicePractitioner(
  input: ProfessionalServicePractitionerInput & { id: string }
) {
  const profile = await assertCapability("access_professional_services");
  const fields = resolvedPractitionerFields(input);
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("professional_service_practitioners")
    .select("id, created_by, provider_id")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Person not found.");
  if (existing.created_by !== profile.id && !isAdmin(profile)) {
    throw new Error("You can only edit people you added.");
  }

  const { error } = await supabase
    .from("professional_service_practitioners")
    .update({
      name: fields.name,
      role_title: fields.role_title,
      notes: fields.notes,
    })
    .eq("id", input.id);
  throwIfDbError(error);
  revalidateProfessionalServices(existing.provider_id);
}

export async function deleteProfessionalServicePractitioner(input: {
  id: string;
  providerId: string;
}) {
  const profile = await assertCapability("access_professional_services");
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("professional_service_practitioners")
    .select("id, created_by, provider_id")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Person not found.");
  if (existing.created_by !== profile.id && !isAdmin(profile)) {
    throw new Error("You can only delete people you added.");
  }

  const { error } = await supabase
    .from("professional_service_practitioners")
    .delete()
    .eq("id", input.id);
  throwIfDbError(error);
  revalidateProfessionalServices(input.providerId || existing.provider_id);
}

export async function setProfessionalServicePractitionerHidden(input: {
  id: string;
  providerId: string;
  isHidden: boolean;
}) {
  const profile = await assertCapability("access_professional_services");
  if (!isAdmin(profile)) throw new Error("Only admins can hide people.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("professional_service_practitioners")
    .update({ is_hidden: input.isHidden })
    .eq("id", input.id);
  throwIfDbError(error);
  revalidateProfessionalServices(input.providerId);
}

export async function upsertProfessionalServiceReview(input: ProfessionalServiceReviewInput) {
  const profile = await assertCapability("access_professional_services");
  const providerId = input.providerId.trim();
  if (!providerId) throw new Error("Provider is required.");
  const practitionerId = input.practitionerId?.trim() || null;

  const fields = {
    verdict: parseVerdict(input.verdict),
    is_anonymous: Boolean(input.isAnonymous),
    body: normalizeOptionalText(input.body),
    used_for: normalizeOptionalText(input.usedFor),
    service_date: parseOptionalServiceDate(input.serviceDate),
  };

  const supabase = await createSupabaseServerClient();

  if (practitionerId) {
    const { data: practitioner, error: practitionerError } = await supabase
      .from("professional_service_practitioners")
      .select("id, provider_id")
      .eq("id", practitionerId)
      .maybeSingle();
    throwIfDbError(practitionerError);
    if (!practitioner || practitioner.provider_id !== providerId) {
      throw new Error("Choose a person at this practice.");
    }
  }

  let existingQuery = supabase
    .from("professional_service_reviews")
    .select("id")
    .eq("provider_id", providerId)
    .eq("created_by", profile.id);
  existingQuery = practitionerId
    ? existingQuery.eq("practitioner_id", practitionerId)
    : existingQuery.is("practitioner_id", null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  throwIfDbError(existingError);

  if (existing) {
    const { error } = await supabase
      .from("professional_service_reviews")
      .update(fields)
      .eq("id", existing.id);
    throwIfDbError(error);
  } else {
    const { error } = await supabase.from("professional_service_reviews").insert({
      client_id: profile.client_id,
      provider_id: providerId,
      practitioner_id: practitionerId,
      created_by: profile.id,
      ...fields,
    });
    throwIfDbError(error);
  }

  revalidateProfessionalServices(providerId);
}

export async function deleteProfessionalServiceReview(input: {
  id: string;
  providerId: string;
}) {
  const profile = await assertCapability("access_professional_services");
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("professional_service_reviews")
    .select("id, created_by, provider_id")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Review not found.");
  if (existing.created_by !== profile.id && !isAdmin(profile)) {
    throw new Error("You can only delete your own reviews.");
  }

  const { error } = await supabase.from("professional_service_reviews").delete().eq("id", input.id);
  throwIfDbError(error);
  revalidateProfessionalServices(input.providerId || existing.provider_id);
}
