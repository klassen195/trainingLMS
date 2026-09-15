import Link from "next/link";
import { Image } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  getClientLogoPreviewUrl,
  getCurrentClientBranding,
} from "@/app/admin/branding/actions";
import { DepartmentBrandingForm } from "@/components/DepartmentBrandingForm";
import { Button } from "@/components/ui/Button";

export default async function AdminBrandingPage() {
  await requireAdmin();
  const [client, previewUrl] = await Promise.all([
    getCurrentClientBranding(),
    getClientLogoPreviewUrl(),
  ]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Image className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Branding</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Upload your department logo for PDF report letterheads.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <DepartmentBrandingForm client={client} previewUrl={previewUrl} />
    </div>
  );
}
