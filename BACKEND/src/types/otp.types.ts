/**
 * otp.types.ts
 *
 * All shared TypeScript interfaces and domain types for the
 * OTP Delivery via SMS Feature (F-02).
 *
 * Requirements: US-002 FR-007, FR-012, FR-013
 */

// ---------------------------------------------------------------------------
// Service request / result DTOs
// ---------------------------------------------------------------------------

/**
 * Input required to generate, persist, and dispatch a new OTP for a user.
 */
export interface OtpDispatchRequestDto {
  userId: string;
}

/**
 * Result returned by OtpService.sendOtp() / resendOtp().
 * Never carries the plaintext OTP value.
 */
export interface OtpDispatchResult {
  accepted: boolean;
  status: 'delivered' | 'failed';
}

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

/**
 * Persisted OTP request record. codeHash stores the HMAC hash of the OTP;
 * plaintext is NEVER stored.
 */
export interface OtpRequestEntity {
  id: string;                                       // UUID v4
  userId: string;                                    // FK -> users.id
  emailAddress: string;
  codeHash: string;
  status: 'pending' | 'delivered' | 'failed';
  createdAt: Date;
  expiresAt: Date;
  invalidatedAt: Date | null;
  attemptSequence: number;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Result returned by the OTP rate-limit guard.
 */
export interface OtpRateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
}
