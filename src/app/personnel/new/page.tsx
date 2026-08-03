import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { InvitePersonnelForm } from "@/components/InvitePersonnelForm";
import { Button } from "@/components/ui/Button";

export default async function InvitePersonnelPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Invite member</h1>
        <p className="mt-2 text-muted-foreground">
          Send a Supabase invite email. A personnel profile is created when they accept.
        </p>
      </div>
      <InvitePersonnelForm />
      <div className="mt-6">
        <Button asChild variant="secondary">
          <Link href="/personnel">Back to directory</Link>
        </Button>
      </div>
    </div>
  );
}
