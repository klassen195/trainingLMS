import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { InvitePersonnelForm } from "@/components/InvitePersonnelForm";
import { Button } from "@/components/ui/Button";
import { listPermissionLevels } from "@/lib/permission-levels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function InvitePersonnelPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { rows: permissionLevels, error } = await listPermissionLevels(supabase);
  if (error) throw error;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Add member</h1>
        <p className="mt-2 text-muted-foreground">
          Create a personnel record now. You can send their sign-in invite from their file when
          you are ready.
        </p>
      </div>
      <InvitePersonnelForm permissionLevels={permissionLevels} />
      <div className="mt-6">
        <Button asChild variant="secondary">
          <Link href="/personnel">Back to directory</Link>
        </Button>
      </div>
    </div>
  );
}
