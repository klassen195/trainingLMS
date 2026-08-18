import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeAppPath } from "@/lib/auth-redirect";
import { LoginForm } from "./ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectedFrom?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = safeAppPath(params.redirectedFrom);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.is_active === false) {
      await supabase.auth.signOut();
    } else {
      redirect(redirectTo);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>TrainingLMS</CardTitle>
          <CardDescription>
            Sign in with a magic link, email code, or password. First-time users should start with magic link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm initialError={params.error} redirectTo={redirectTo} />
        </CardContent>
      </Card>
    </div>
  );
}
