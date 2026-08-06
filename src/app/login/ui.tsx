"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestPasswordReset,
  sendSignInCode,
  signInWithMagicLink,
  signInWithPassword,
  verifySignInCode,
} from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

const LAST_EMAIL_KEY = "training-lms:last-email";
const COOLDOWN_SECONDS = 60;

const AUTH_ERRORS: Record<string, string> = {
  auth_callback_failed: "Sign-in link expired or was already used. Request a new magic link or use a sign-in code.",
  auth_config_missing: "Authentication is not configured. Contact your administrator.",
  account_deactivated:
    "This account has been deactivated. Contact a system administrator if you need access restored.",
};

type SignInMethod = "magic_link" | "code" | "password";

type LoginFormProps = {
  initialError?: string | null;
};

const METHODS: { id: SignInMethod; label: string }[] = [
  { id: "magic_link", label: "Magic link" },
  { id: "code", label: "Email code" },
  { id: "password", label: "Password" },
];

export function LoginForm({ initialError }: LoginFormProps) {
  const router = useRouter();
  const [method, setMethod] = useState<SignInMethod>("magic_link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(
    initialError ? (AUTH_ERRORS[initialError] ?? "Sign-in failed. Try again.") : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(LAST_EMAIL_KEY);
    if (stored) setEmail(stored);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function rememberEmail(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized) {
      window.localStorage.setItem(LAST_EMAIL_KEY, normalized);
    }
  }

  function startCooldown() {
    setCooldown(COOLDOWN_SECONDS);
  }

  function switchMethod(next: SignInMethod) {
    setMethod(next);
    setError(null);
    setSent(false);
    setCodeSent(false);
    setResetSent(false);
    setCode("");
    setPassword("");
  }

  async function onMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);
    try {
      rememberEmail(email);
      const result = await signInWithMagicLink({
        email,
        origin: window.location.origin,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendCode() {
    setError(null);
    setLoading(true);
    try {
      rememberEmail(email);
      const result = await sendSignInCode({ email });
      if (result.error) {
        setError(result.error);
        return;
      }
      setCodeSent(true);
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      rememberEmail(email);
      const result = await verifySignInCode({ email, code });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      rememberEmail(email);
      const result = await signInWithPassword({ email, password });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
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
      rememberEmail(email);
      const result = await requestPasswordReset({
        email,
        origin: window.location.origin,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setResetSent(true);
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  const emailField = (
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
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {METHODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchMethod(item.id)}
            className={cn(
              "rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
              method === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {method === "magic_link" ? (
        <form onSubmit={onMagicLinkSubmit} className="space-y-4">
          {emailField}
          <p className="text-xs text-muted-foreground">
            First time here? Use magic link to create your account.
          </p>
          <Button type="submit" disabled={loading || cooldown > 0} className="w-full">
            {loading ? "Sending link..." : cooldown > 0 ? `Wait ${cooldown}s` : "Send magic link"}
          </Button>
          {sent ? (
            <p className="text-sm text-green-600">
              Check your inbox for the sign-in link. If it does not arrive within a minute, check spam or try the
              email code option.
            </p>
          ) : null}
        </form>
      ) : null}

      {method === "code" ? (
        <div className="space-y-4">
          {!codeSent ? (
            <form onSubmit={onSendCode} className="space-y-4">
              {emailField}
              <p className="text-xs text-muted-foreground">
                Returning user? We will email a 6-digit code to sign in without clicking a link.
              </p>
              <Button type="submit" disabled={loading || cooldown > 0} className="w-full">
                {loading ? "Sending code..." : cooldown > 0 ? `Wait ${cooldown}s` : "Send sign-in code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onVerifyCode} className="space-y-4">
              <p className="text-sm text-green-600">
                Check your inbox for a 6-digit code and enter it below.
              </p>
              {emailField}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="code">
                  Sign-in code
                </label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="tracking-[0.3em]"
                />
              </div>
              <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                {loading ? "Signing in..." : "Sign in with code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || cooldown > 0}
                className="w-full"
                onClick={() => {
                  setCode("");
                  void sendCode();
                }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {method === "password" ? (
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          {emailField}
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
            Set a password from Account after your first magic-link sign-in.
          </p>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in with password"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading || !email || cooldown > 0}
            className="w-full"
            onClick={onForgotPassword}
          >
            {resetSent
              ? "Reset email sent"
              : cooldown > 0
                ? `Wait ${cooldown}s`
                : "Forgot password?"}
          </Button>
          {resetSent ? (
            <p className="text-sm text-green-600">
              Check your inbox for a password reset link.
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
