import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { CHANGE_PASSWORD_PATH, userMustChangePassword } from "@/lib/auth-password";
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
    const isActive =
      profile?.is_active ??
      (
        await createSupabaseServiceClient()
          .from("profiles")
          .select("is_active")
          .eq("id", user.id)
          .maybeSingle()
      ).data?.is_active;
    if (isActive === false) {
      await supabase.auth.signOut();
    } else if (userMustChangePassword(user)) {
      const changeUrl = new URL(CHANGE_PASSWORD_PATH, "http://local");
      if (redirectTo && redirectTo !== "/") changeUrl.searchParams.set("next", redirectTo);
      redirect(`${changeUrl.pathname}${changeUrl.search}`);
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
            Sign in with your email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm initialError={params.error} redirectTo={redirectTo} />
        </CardContent>
      </Card>
    </div>
  );
}
