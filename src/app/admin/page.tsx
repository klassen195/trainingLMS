import { Shield } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Admin</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Manage locations, permission settings, and department checklists.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personnel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Directory, invites, org details, certifications, documents, and training assignment.
            </p>
            <Button asChild>
              <Link href="/personnel">Manage personnel</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Locations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Manage stations and other sites for asset assignment.
            </p>
            <Button asChild>
              <Link href="/admin/locations">Manage locations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipment categories</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Manage the fixed category list for equipment inventory.
            </p>
            <Button asChild>
              <Link href="/admin/equipment-categories">Manage categories</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipment subcategories</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Manage subcategory lists under each equipment category.
            </p>
            <Button asChild>
              <Link href="/admin/equipment-subcategories">Manage subcategories</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vehicle checks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Edit Daily and Weekly apparatus checklist templates.
            </p>
            <Button asChild>
              <Link href="/admin/vehicle-checks">Manage templates</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Maintenance requests</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Review and resolve apparatus maintenance requests.
            </p>
            <Button asChild>
              <Link href="/admin/maintenance">Manage requests</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
