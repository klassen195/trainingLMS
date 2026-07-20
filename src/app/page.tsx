import Link from "next/link";
import { ArrowLeftRight, GraduationCap } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function HomePage() {
  const auth = await getAuthContext();
  const isSignedIn = auth.kind === "authenticated";

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">Kootenai Fire Tools</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Shift Exchange is open to everyone. Training LMS requires a department sign-in.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <CardTitle>Shift Exchange</CardTitle>
            <CardDescription>
              Submit station notes and mark them resolved. No login required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/shift-exchange">Open Shift Exchange</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <CardTitle>Training LMS</CardTitle>
            <CardDescription>
              Programs, modules, quizzes, and instructor tools for department training.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant={isSignedIn ? "default" : "outline"}>
              <Link href={isSignedIn ? "/dashboard" : "/login"}>
                {isSignedIn ? "Go to Dashboard" : "Sign in to Training"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
