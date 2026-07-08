export interface RegisterUserRequest {
  username: string;
  emailAddress: string;
  password: string;
  passwordConfirmation: string;
}

export interface RegisterUserSuccessResponse {
  userId: string;
  message: string;
}

export interface RegisterUserFieldError {
  fieldName: string;
  errorMessage: string;
}

export interface RegisterUserValidationErrorResponse {
  isValid: false;
  fieldErrors: RegisterUserFieldError[];
}

export interface RegisterUserPasswordPolicyErrorResponse {
  error: "PASSWORD_POLICY_VIOLATION";
  violations: string[];
}

export interface RegisterUserUsernameUnavailableErrorResponse {
  error_code: "USERNAME_UNAVAILABLE";
  message: string;
  field: string;
  suggestion_hint: string;
}

export interface RegisterUserGenericErrorResponse {
  error: string;
}

export type RegisterUserErrorResponse =
  | RegisterUserValidationErrorResponse
  | RegisterUserPasswordPolicyErrorResponse
  | RegisterUserUsernameUnavailableErrorResponse
  | RegisterUserGenericErrorResponse;
