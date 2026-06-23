"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
