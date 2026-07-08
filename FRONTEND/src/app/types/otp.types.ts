export interface VerifyOtpRequest {
  userId: string;
  passcode: string;
}

export interface VerifyOtpSuccessResponse {
  message: string;
  userId: string;
  activatedAt: string;
}

export interface OtpErrorResponse {
  errorCode: "OTP_NOT_FOUND" | "OTP_EXPIRED" | "OTP_INVALID" | "OTP_FORBIDDEN" | "OTP_RATE_LIMIT_EXCEEDED";
  message: string;
}

export interface ResendOtpRequest {
  userId: string;
}

export interface ResendOtpSuccessResponse {
  status: "accepted" | "dispatch_failed";
}
