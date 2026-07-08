/**
 * account-deletion.types.ts
 *
 * All shared TypeScript interfaces and domain types for the
 * Account Deletion Feature (F-04).
 */

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

/**
 * Single-use, time-bounded OTP code guarding account deletion (one active
 * request per user). codeHash is an HMAC hash of a 6-digit numeric code
 * emailed to the user; the plaintext code is never persisted, matching
 * otp.service.ts's convention for registration OTPs.
 */
export interface DeletionRequestEntity {
  id: string;                                    // UUID v4
  userId: string;                                 // FK → users.id
  codeHash: string;                               // HMAC hash of the 6-digit OTP code
  issuedAt: Date;
  expiresAt: Date;                                // issuedAt + ACCOUNT_DELETION_OTP_EXPIRY_MINUTES
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmedAt: Date | null;
  cancelledAt: Date | null;
}

/**
 * Transactional outbox record that drives async delivery of the
 * post-deletion notification email. Rows with deliveryStatus = 'queued' are
 * picked up by AccountDeletionNotificationWorker.
 *
 * recipientAddress is captured BEFORE the owning user's email is
 * anonymized — it is the only place that address survives confirmation.
 */
export interface DeletionNotificationRecord {
  recordId: string;                               // UUID v4
  userId: string;                                 // retained for logging only — no FK (see design.md)
  recipientAddress: string;
  deletionDate: Date;
  dispatchTimestamp: Date;
  deliveryStatus: 'queued' | 'sent' | 'failed';
  retryCount: number;                             // default 0
}

// ---------------------------------------------------------------------------
// Service result types
// ---------------------------------------------------------------------------

/**
 * Returned by AccountDeletionService.requestDeletion() on success.
 */
export interface DeletionRequestResult {
  requestId: string;
  expiresAt: Date;
}

/**
 * Returned by AccountDeletionService.confirmDeletion() on success.
 */
export interface DeletionConfirmationResult {
  userId: string;
  deletedAt: Date;
}
