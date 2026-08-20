export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("over_email_send")) {
    return "Too many emails were sent. Wait a minute and try again.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (lower.includes("email not confirmed")) {
    return "This account is not ready to sign in yet. Ask an administrator to issue a temporary password.";
  }

  if (lower.includes("signup") && lower.includes("disabled")) {
    return "No account exists for that email. Ask an administrator to create your account.";
  }

  if (lower.includes("token") && (lower.includes("invalid") || lower.includes("expired"))) {
    return "That password reset link is invalid or expired. Request a new one.";
  }

  return message;
}
