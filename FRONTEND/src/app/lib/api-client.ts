import type {
  RegisterUserErrorResponse,
  RegisterUserRequest,
  RegisterUserSuccessResponse,
} from "../types/registration.types";
import type {
  OtpErrorResponse,
  ResendOtpRequest,
  ResendOtpSuccessResponse,
  VerifyOtpRequest,
  VerifyOtpSuccessResponse,
} from "../types/otp.types";
import type {
  LoginErrorResponse,
  LoginRequest,
  LoginSuccessResponse,
} from "../types/login.types";
import type {
  CancelDeletionErrorResponse,
  CancelDeletionSuccessResponse,
  ConfirmDeletionErrorResponse,
  ConfirmDeletionSuccessResponse,
  RequestDeletionErrorResponse,
  RequestDeletionSuccessResponse,
} from "../types/deletion.types";
import type { ProfileErrorResponse, UserProfileResponse } from "../types/profile.types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export type ApiResult<TSuccess, TError> =
  | { ok: true; data: TSuccess }
  | { ok: false; status: number; body: TError };

async function postJson<TSuccess, TError>(
  path: string,
  payload: unknown
): Promise<ApiResult<TSuccess, TError>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json();

  if (response.ok) {
    return { ok: true, data: body as TSuccess };
  }

  return { ok: false, status: response.status, body: body as TError };
}

export async function registerUser(
  payload: RegisterUserRequest
): Promise<ApiResult<RegisterUserSuccessResponse, RegisterUserErrorResponse>> {
  return postJson<RegisterUserSuccessResponse, RegisterUserErrorResponse>(
    "/api/v1/users/register",
    payload
  );
}

export async function verifyOtp(
  payload: VerifyOtpRequest
): Promise<ApiResult<VerifyOtpSuccessResponse, OtpErrorResponse>> {
  return postJson<VerifyOtpSuccessResponse, OtpErrorResponse>("/api/v1/otp/verify", payload);
}

export async function resendOtp(
  payload: ResendOtpRequest
): Promise<ApiResult<ResendOtpSuccessResponse, OtpErrorResponse>> {
  return postJson<ResendOtpSuccessResponse, OtpErrorResponse>("/api/v1/otp/resend", payload);
}

export async function loginUser(
  payload: LoginRequest
): Promise<ApiResult<LoginSuccessResponse, LoginErrorResponse>> {
  return postJson<LoginSuccessResponse, LoginErrorResponse>("/api/v1/auth/login", payload);
}

export async function logoutUser(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function authRequest<TSuccess, TError>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  token: string
): Promise<ApiResult<TSuccess, TError>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await response.json();

  if (response.ok) {
    return { ok: true, data: body as TSuccess };
  }

  return { ok: false, status: response.status, body: body as TError };
}

async function authPostJson<TSuccess, TError>(
  path: string,
  token: string,
  payload: unknown
): Promise<ApiResult<TSuccess, TError>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json();

  if (response.ok) {
    return { ok: true, data: body as TSuccess };
  }

  return { ok: false, status: response.status, body: body as TError };
}

export async function requestAccountDeletion(
  token: string
): Promise<ApiResult<RequestDeletionSuccessResponse, RequestDeletionErrorResponse>> {
  return authRequest<RequestDeletionSuccessResponse, RequestDeletionErrorResponse>(
    "/api/v1/users/deletion-requests",
    "POST",
    token
  );
}

export async function cancelAccountDeletion(
  token: string
): Promise<ApiResult<CancelDeletionSuccessResponse, CancelDeletionErrorResponse>> {
  return authRequest<CancelDeletionSuccessResponse, CancelDeletionErrorResponse>(
    "/api/v1/users/deletion-requests",
    "DELETE",
    token
  );
}

export async function confirmAccountDeletion(
  token: string,
  code: string
): Promise<ApiResult<ConfirmDeletionSuccessResponse, ConfirmDeletionErrorResponse>> {
  return authPostJson<ConfirmDeletionSuccessResponse, ConfirmDeletionErrorResponse>(
    "/api/v1/users/deletion-requests/confirm",
    token,
    { code }
  );
}

export async function getCurrentUser(
  token: string
): Promise<ApiResult<UserProfileResponse, ProfileErrorResponse>> {
  return authRequest<UserProfileResponse, ProfileErrorResponse>("/api/v1/users/me", "GET", token);
}
