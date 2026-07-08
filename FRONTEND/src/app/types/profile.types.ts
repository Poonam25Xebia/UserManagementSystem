export interface UserProfileResponse {
  username: string;
  email: string;
  status: "pending" | "active" | "suspended" | "deleted";
  registrationTimestamp: string;
  lastLoginAt: string | null;
  activeSessions: number;
}

export interface ProfileErrorResponse {
  error?: string;
  error_code?: "USER_NOT_FOUND";
  message?: string;
}
