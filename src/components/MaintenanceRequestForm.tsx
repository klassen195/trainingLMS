"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMaintenanceRequest,
  deleteMaintenanceRequest,
  finalizeMaintenanceRequest,
  prepareMaintenancePhotoUpload,
} from "@/app/assets/maintenance-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AssetKind } from "@/lib/assets-types";
import {
  MAINTENANCE_PHOTO_ACCEPT,
  MAINTENANCE_PHOTO_BUCKET,
  isMaintenancePhotoFile,
  type MaintenanceRequestType,
  type MaintenanceServiceStatus,
} from "@/lib/maintenance-types";
import {
  maintenanceRequestTypeLabel,
  maintenanceRequestTypes,
  maintenanceServiceStatusLabel,
  maintenanceServiceStatuses,
} from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Select, Textarea, Input } from "@/components/ui/Input";

export function MaintenanceRequestForm({
  assetId,
  assetKind = "apparatus",
  vehicleCheckId = null,
  initialTitle = "",
  initialDescription = "",
}: {
  assetId: string;
  assetKind?: AssetKind;
  vehicleCheckId?: string | null;
  initialTitle?: string;
  initialDescription?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [serviceStatus, setServiceStatus] =
    useState<MaintenanceServiceStatus>("in_service");
  const [requestType, setRequestType] = useState<MaintenanceRequestType>("minor");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Request maintenance</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              let createdId: string | null = null;
              let storagePath: string | null = null;
              try {
                const file = fileInputRef.current?.files?.[0] ?? null;
                if (file && !isMaintenancePhotoFile(file)) {
                  throw new Error("Photo must be a JPEG, PNG, WebP, or HEIC image.");
                }

                const { requestId } = await createMaintenanceRequest({
                  assetId,
                  serviceStatus,
                  requestType,
                  title,
                  description,
                  vehicleCheckId,
                });
                createdId = requestId;

                if (file) {
                  const prepared = await prepareMaintenancePhotoUpload({
                    requestId,
                    assetId,
                    fileName: file.name,
                  });
                  storagePath = prepared.storagePath;

                  const supabase = createSupabaseBrowserClient();
                  const { error: uploadError } = await supabase.storage
                    .from(MAINTENANCE_PHOTO_BUCKET)
                    .upload(storagePath, file, { upsert: false });

                  if (uploadError) {
                    throw uploadError;
                  }
                }

                await finalizeMaintenanceRequest({
                  requestId,
                  assetId,
                });

                router.push(`/assets/${assetId}`);
                router.refresh();
              } catch (err) {
                if (createdId) {
                  try {
                    await deleteMaintenanceRequest({
                      requestId: createdId,
                      assetId,
                      storagePath,
                    });
                  } catch {
                    // Keep the original error for the user.
                  }
                }
                setError(err instanceof Error ? err.message : "Something went wrong.");
              }
            });
          }}
        >
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="maint-service-status">
              {assetKind === "apparatus" ? "Vehicle status" : "Equipment status"}
            </FieldLabel>
            <Select
              id="maint-service-status"
              value={serviceStatus}
              onChange={(e) =>
                setServiceStatus(e.target.value as MaintenanceServiceStatus)
              }
              required
            >
              {maintenanceServiceStatuses.map((status) => (
                <option key={status} value={status}>
                  {maintenanceServiceStatusLabel(status)}
                </option>
              ))}
            </Select>
            {serviceStatus === "out_of_service" ? (
              <FieldHint>
                Submitting will mark this{" "}
                {assetKind === "apparatus" ? "apparatus" : "item"} Out of service until
                an admin changes it.
              </FieldHint>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="maint-type">Maintenance type</FieldLabel>
            <Select
              id="maint-type"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as MaintenanceRequestType)}
              required
            >
              {maintenanceRequestTypes.map((type) => (
                <option key={type} value={type}>
                  {maintenanceRequestTypeLabel(type)}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="maint-title">Title</FieldLabel>
            <Input
              id="maint-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Short summary of the issue"
            />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="maint-description">Description (optional)</FieldLabel>
            <Textarea
              id="maint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Add details if needed."
            />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="maint-photo">Photo (optional)</FieldLabel>
            <input
              ref={fileInputRef}
              id="maint-photo"
              type="file"
              accept={MAINTENANCE_PHOTO_ACCEPT}
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <FieldHint>JPEG, PNG, WebP, or HEIC. Max 20 MB.</FieldHint>
          </div>

          {error ? <FieldError>{error}</FieldError> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} className="bg-[#C11B2B] text-white">
              {pending ? "Submitting..." : "Submit request"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => router.push(`/assets/${assetId}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
