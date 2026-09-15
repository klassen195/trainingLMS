"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProfessionalServiceProvider,
  updateProfessionalServiceProvider,
  type ProfessionalServiceProviderInput,
} from "@/app/professional-services/actions";
import {
  PROFESSIONAL_SERVICE_CATEGORIES,
  PROFESSIONAL_SERVICE_CATEGORY_LABELS,
  type ProfessionalServiceCategory,
  type ProfessionalServiceProvider,
} from "@/lib/professional-services-types";
import { formatPhoneInput } from "@/lib/phone";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function ProfessionalServiceProviderForm({
  provider,
  onDone,
}: {
  provider?: ProfessionalServiceProvider | null;
  onDone: (providerId?: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(provider?.name ?? "");
  const [category, setCategory] = useState<ProfessionalServiceCategory>(
    provider?.category ?? "other"
  );
  const [specialty, setSpecialty] = useState(provider?.specialty ?? "");
  const [phone, setPhone] = useState(() => formatPhoneInput(provider?.phone ?? ""));
  const [email, setEmail] = useState(provider?.email ?? "");
  const [website, setWebsite] = useState(provider?.website ?? "");
  const [city, setCity] = useState(provider?.city ?? "");
  const [address, setAddress] = useState(provider?.address ?? "");
  const [notes, setNotes] = useState(provider?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload: ProfessionalServiceProviderInput = {
      name,
      category,
      specialty,
      phone,
      email,
      website,
      city,
      address,
      notes,
    };
    try {
      if (provider) {
        await updateProfessionalServiceProvider({ ...payload, id: provider.id });
        router.refresh();
        onDone(provider.id);
      } else {
        const id = await createProfessionalServiceProvider(payload);
        router.refresh();
        onDone(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save provider");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-name">Name</FieldLabel>
        <Input
          id="ps-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dr. Smith / Acme Auto"
        />
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-category">Category</FieldLabel>
        <Select
          id="ps-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ProfessionalServiceCategory)}
        >
          {PROFESSIONAL_SERVICE_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {PROFESSIONAL_SERVICE_CATEGORY_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-specialty">Specialty</FieldLabel>
        <Input
          id="ps-specialty"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="Orthopedics, brakes, roofing…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="ps-phone">Phone</FieldLabel>
          <Input
            id="ps-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="(555) 555-5555"
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="ps-email">Email</FieldLabel>
          <Input
            id="ps-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="office@example.com"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-website">Website</FieldLabel>
        <Input
          id="ps-website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="ps-city">City / area</FieldLabel>
          <Input
            id="ps-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Post Falls"
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="ps-address">Address</FieldLabel>
          <Input
            id="ps-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-notes">Notes</FieldLabel>
        <Textarea
          id="ps-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Office hours, parking, insurance notes…"
          rows={3}
        />
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : provider ? "Save changes" : "Add provider"}
        </Button>
      </div>
    </form>
  );
}
