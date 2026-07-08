/**
 * otp-delivery.port.ts
 *
 * Provider-agnostic interface for outbound OTP delivery.  Delivery is via
 * email for this deployment (see tasks.md task 2 deviation note); a concrete
 * adapter wrapping the existing EmailDeliveryPort / SendGridEmailAdapter is
 * implemented as part of task 5.
 *
 * NEVER throws — implementations must convert provider-level failures into a
 * `false` return value rather than raising.
 *
 * Requirements: US-002 FR-005, FR-006, FR-013
 */

export interface OtpDeliveryPort {
  /**
   * Dispatch a one-time code to the given destination address.
   *
   * @param destination - Recipient email address.
   * @param code        - Plaintext OTP code (never persisted or logged by callers).
   * @returns             `true` if the provider accepted the dispatch, `false` on failure.
   */
  dispatch(destination: string, code: string): Promise<boolean>;
}
