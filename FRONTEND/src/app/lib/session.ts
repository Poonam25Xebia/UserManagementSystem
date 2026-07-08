const TOKEN_KEY = "ums_session_token";
const EXPIRES_AT_KEY = "ums_session_expires_at";
const EMAIL_KEY = "ums_session_email";

export function setSession(token: string, expiresAt: string, email?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_AT_KEY, expiresAt);
  if (email) localStorage.setItem(EMAIL_KEY, email);
}

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSessionEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
