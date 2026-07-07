export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("over_email_send")) {
    return "Too many sign-in emails were sent. Wait a minute and try again, or sign in with your password.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in with a password.";
  }

  if (lower.includes("signup") && lower.includes("disabled")) {
    return "No account exists for that email. Use the magic link option for your first sign-in.";
  }

  if (lower.includes("token") && (lower.includes("invalid") || lower.includes("expired"))) {
    return "That sign-in code is invalid or expired. Request a new code.";
  }

  return message;
}
