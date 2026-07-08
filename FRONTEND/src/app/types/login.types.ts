export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginSuccessResponse {
  token: string;
  expires_at: string;
}

export interface LoginErrorResponse {
  error?: string;
  error_code?: "AUTH_INVALID_CREDENTIALS" | "AUTH_ACCOUNT_NOT_ACTIVE" | "AUTH_ACCOUNT_LOCKED" | "SESSION_CREATION_FAILED";
  message?: string;
  retry_after?: string;
}
