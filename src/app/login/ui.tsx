"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { requestPasswordReset, signInWithPassword } from "@/app/actions";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth-password";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const LAST_EMAIL_KEY = "training-lms:last-email";
const LAST_CLIENT_KEY = "training-lms:last-client-code";
const COOLDOWN_SECONDS = 60;

const AUTH_ERRORS: Record<string, string> = {
  auth_callback_failed: "Password reset link expired or was already used. Request a new one.",
  auth_config_missing: "Authentication is not configured. Contact your administrator.",
  account_deactivated:
    "This account has been deactivated. Contact a system administrator if you need access restored.",
  client_required: "Enter your Client ID to sign in.",
  invalid_client: "Invalid Client ID. Check the code from your administrator.",
  client_mismatch: "This account does not belong to that Client ID.",
};

type LoginFormProps = {
  initialError?: string | null;
  redirectTo?: string;
};

function subscribeToStorage(key: string) {
  return (onStoreChange: () => void) => {
    function onStorage(event: StorageEvent) {
      if (event.key === key || event.key === null) onStoreChange();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  };
}

function useStoredValue(key: string) {
  const stored = useSyncExternalStore(
    subscribeToStorage(key),
    () => window.localStorage.getItem(key) ?? "",
    () => ""
  );
  const [draft, setDraft] = useState<string | null>(null);
  return [draft ?? stored, setDraft] as const;
}

export function LoginForm({ initialError, redirectTo = "/" }: LoginFormProps) {
  const router = useRouter();
  const [clientCode, setClientCode] = useStoredValue(LAST_CLIENT_KEY);
  const [email, setEmail] = useStoredValue(LAST_EMAIL_KEY);
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(
    initialError ? (AUTH_ERRORS[initialError] ?? "Sign-in failed. Try again.") : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function rememberCredentials() {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) window.localStorage.setItem(LAST_EMAIL_KEY, normalizedEmail);
    const normalizedClient = clientCode.trim().toUpperCase();
    if (normalizedClient) window.localStorage.setItem(LAST_CLIENT_KEY, normalizedClient);
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      rememberCredentials();
      const result = await signInWithPassword({ email, password, clientCode });
      if (result.error) {
        setError(result.error);
        return;
      }
      if ("mustChangePassword" in result && result.mustChangePassword) {
        const next =
          redirectTo && redirectTo !== "/"
            ? `?next=${encodeURIComponent(redirectTo)}`
            : "";
        router.push(`${CHANGE_PASSWORD_PATH}${next}`);
      } else {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setResetSent(false);
    setLoading(true);
    try {
      rememberCredentials();
      const result = await requestPasswordReset({
        email,
        clientCode,
        origin: window.location.origin,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setResetSent(true);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onPasswordSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="client-code">
          Client ID
        </label>
        <Input
          id="client-code"
          type="text"
          required
          value={clientCode}
          onChange={(e) => setClientCode(e.target.value.toUpperCase())}
          suppressHydrationWarning
          autoComplete="organization"
          placeholder="CLIENT1"
          className="uppercase tracking-wide"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          suppressHydrationWarning
          autoComplete="email"
          placeholder="name@example.com"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Use the Client ID from your administrator. New accounts receive a temporary password from
        personnel.
      </p>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in..." : "Sign in"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={loading || !email || !clientCode || cooldown > 0}
        className="w-full"
        onClick={onForgotPassword}
      >
        {resetSent ? "Reset email sent" : cooldown > 0 ? `Wait ${cooldown}s` : "Forgot password?"}
      </Button>
      {resetSent ? (
        <p className="text-sm text-green-600">Check your inbox for a password reset link.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
