import { requireUserProfile } from "@/lib/auth";
import { AccountPasswordForm } from "./ui";

export default async function AccountPage() {
  const profile = await requireUserProfile();

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {profile.email ?? profile.display_name ?? "member"}.
        </p>
      </div>
      <AccountPasswordForm />
    </div>
  );
}
