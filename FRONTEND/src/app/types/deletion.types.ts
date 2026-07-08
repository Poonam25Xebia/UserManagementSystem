export interface RequestDeletionSuccessResponse {
  message: string;
}

export interface RequestDeletionErrorResponse {
  error?: string;
  error_code?: "AUTH_ACCOUNT_NOT_ACTIVE" | "DELETION_REQUEST_ALREADY_PENDING";
  message?: string;
}

export interface CancelDeletionSuccessResponse {
  message: string;
}

export interface CancelDeletionErrorResponse {
  error?: string;
  error_code?: "DELETION_REQUEST_NOT_FOUND";
  message?: string;
}

export interface ConfirmDeletionRequest {
  code: string;
}

export interface ConfirmDeletionSuccessResponse {
  userId: string;
  deletedAt: string;
}

export interface ConfirmDeletionErrorResponse {
  error?: string;
  error_code?: "DELETION_REQUEST_NOT_FOUND" | "DELETION_OTP_EXPIRED" | "DELETION_OTP_INVALID";
  message?: string;
}
