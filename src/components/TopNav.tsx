import Link from "next/link";
import type { Profile } from "@/lib/training-lms-types";
import { hasRole } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

type NavKey = "dashboard" | "programs" | "instructor" | "admin";

function navClass(active: boolean) {
  return active
    ? "border-[#C11B2B] bg-[#C11B2B] text-white"
    : "border-white/20 bg-transparent text-white/90 hover:bg-white/10 hover:border-white/30";
}

export function TopNav({ profile, active }: { profile: Profile; active: NavKey }) {
  const showInstructor = hasRole(profile, ["instructor", "admin"]);
  const showAdmin = hasRole(profile, ["admin"]);

  return (
    <header className="border-b border-[#0B2E4B]/20 bg-[#0B2E4B] text-white">
      <div className="flex w-full flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">TrainingLMS</h1>
          <p className="text-sm text-white/80">
            {profile.display_name ?? "Member"} · {profile.role}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard" className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${navClass(active === "dashboard")}`}>
            Dashboard
          </Link>
          <Link href="/programs" className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${navClass(active === "programs")}`}>
            Programs
          </Link>
          {showInstructor ? (
            <Link href="/instructor" className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${navClass(active === "instructor")}`}>
              Instructor
            </Link>
          ) : null}
          {showAdmin ? (
            <Link href="/admin" className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${navClass(active === "admin")}`}>
              Admin
            </Link>
          ) : null}
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
