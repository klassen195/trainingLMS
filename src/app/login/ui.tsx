"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (signInError) throw signInError;
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        suppressHydrationWarning
        autoComplete="email"
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0B2E4B]/20 dark:border-zinc-800 dark:bg-zinc-950"
        placeholder="name@department.gov"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#C11B2B] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Sending link..." : "Send magic link"}
      </button>

      {sent ? (
        <p className="text-sm text-green-700">Check your email for the sign-in link.</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
