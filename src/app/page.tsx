import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth-password";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadHomeDashboard } from "@/lib/home-dashboard";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { HomeDashboard } from "@/components/HomeDashboard";
import { Button } from "@/components/ui/Button";

export default async function HomePage() {
  const auth = await getAuthContext();
  if (auth.kind === "missing_tables") return <DatabaseSetup />;
  if (auth.kind === "missing_profile") return <MissingProfileSetup userId={auth.userId} />;

  if (auth.kind === "authenticated") {
    if (auth.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
    const supabase = await createSupabaseServerClient();
    const capabilities = await getProfileCapabilities(auth.profile);
    const payload = await loadHomeDashboard({
      profile: auth.profile,
      capabilities,
      supabase,
    });
    return <HomeDashboard payload={payload} />;
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-12rem)] flex-col items-start justify-center px-4 py-12">
      <h1 className="text-4xl font-bold tracking-tight">Anchor Point</h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">
        Department operations, training, and personnel tools. Sign in to open your home dashboard.
      </p>
      <Button asChild className="mt-6">
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  );
}
