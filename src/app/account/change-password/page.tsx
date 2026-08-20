import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth-password";
import { safeAppPath } from "@/lib/auth-redirect";
import { AccountPasswordForm } from "../ui";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeAppPath(params.next);
  const ctx = await getAuthContext();

  if (ctx.kind === "unauthenticated") redirect("/login");
  if (ctx.kind !== "authenticated") redirect("/");
  if (!ctx.mustChangePassword) redirect(next);

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Set your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {ctx.profile.email ?? ctx.profile.display_name ?? "member"}. Choose a new
          password before using the rest of the site.
        </p>
      </div>
      <AccountPasswordForm
        title="Choose a new password"
        description="Your administrator issued a temporary password. You must replace it to continue."
        submitLabel="Save and continue"
        redirectTo={next === CHANGE_PASSWORD_PATH ? "/" : next}
      />
    </div>
  );
}
