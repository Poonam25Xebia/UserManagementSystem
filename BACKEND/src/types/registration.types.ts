/**
 * registration.types.ts
 *
 * All shared TypeScript interfaces and domain types for the
 * User Registration Feature (F-01).
 */

// ---------------------------------------------------------------------------
// Request / Validation DTOs
// ---------------------------------------------------------------------------

/**
 * Incoming payload for the POST /api/v1/users/register endpoint.
 * All fields are raw strings exactly as supplied by the caller.
 * Plaintext password is NEVER persisted.
 */
export interface RegistrationRequestDto {
  username: string;
  emailAddress: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * A single field-level validation error returned to the caller.
 */
export interface FieldError {
  fieldName: string;
  errorMessage: string;
}

/**
 * Result of running the mandatory-fields / structural validation pipeline.
 * All errors are collected before returning (no short-circuit on first error).
 */
export interface RegistrationValidationResult {
  isValid: boolean;
  fieldErrors: FieldError[];
}

// ---------------------------------------------------------------------------
// Password policy
// ---------------------------------------------------------------------------

/**
 * Configurable password complexity rules loaded from environment variables
 * at application startup.  Immutable at runtime.
 */
export interface PasswordPolicy {
  minimumLength: number;          // default: 8
  maximumLength: number;          // default: 128
  requiresUppercase: boolean;     // default: true
  requiresLowercase: boolean;     // default: true
  requiresDigit: boolean;         // default: true
  requiresSpecialCharacter: boolean; // default: true
}

/**
 * Result returned by PasswordPolicyEvaluator.evaluate().
 * violations is empty iff valid === true.
 */
export interface PasswordValidationResult {
  valid: boolean;
  violations: string[];
}

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

/**
 * Persisted user record.  passwordHash stores the bcrypt hash; plaintext
 * is NEVER stored.
 *
 * failedLoginCount, lockedUntil, and lastLoginAt are added by the User Login
 * Feature (F-03) — see .kiro/specs/user_login/design.md Data Models. They live
 * on this same UserEntity/`users` table rather than a parallel type because
 * both features read and write the same persisted row. Populated by the
 * `005_alter_users_for_login.sql` migration (DB defaults: 0, null, null) and
 * by UserRepository's rowToEntity mapper — always present on any row read
 * after that migration has run.
 */
export interface UserEntity {
  id: string;                             // UUID v4
  username: string;                       // display value, original casing
  usernameNormalised: string;             // lower(trim(username))
  email: string;                          // validated email address
  passwordHash: string;                   // bcrypt hash
  status: 'pending' | 'active' | 'suspended' | 'deleted'; // 'deleted' added by F-04 — terminal, self-inflicted
  registrationTimestamp: Date;
  activatedAt: Date | null;
  failedLoginCount: number;               // F-03, default 0
  lockedUntil: Date | null;               // F-03, default null — temporary lockout, distinct from `suspended`
  lastLoginAt: Date | null;               // F-03, default null
  deletedAt: Date | null;                 // F-04, default null — set once, never cleared
}

/**
 * Single-use, time-bounded token for account activation (one per user).
 * tokenValue is a 128-char base64url string from crypto.randomBytes(96).
 */
export interface ActivationToken {
  id: string;           // UUID v4
  userId: string;       // FK → users.id (UNIQUE — one per user)
  tokenValue: string;   // 128-char cryptographically random string
  issuedAt: Date;
  expiresAt: Date;      // issuedAt + 24h
  consumed: boolean;    // default false
  consumedAt: Date | null;
}

/**
 * Transactional outbox record that drives async email delivery.
 * Rows with deliveryStatus = 'queued' are picked up by OutboxWorker.
 */
export interface RegistrationEmailRecord {
  recordId: string;             // UUID v4
  userId: string;               // FK → users.id (UNIQUE — one per user)
  recipientAddress: string;     // email address to send to
  dispatchTimestamp: Date;
  deliveryStatus: 'queued' | 'sent' | 'failed';
  retryCount: number;           // default 0
  activationTokenId: string;    // FK → activation_tokens.id
}

// ---------------------------------------------------------------------------
// Service result types
// ---------------------------------------------------------------------------

/**
 * Returned by RegistrationService.register() on success.
 */
export interface UserCreatedResult {
  userId: string;
  message: string;
}

/**
 * Returned by ActivationService.activate() on success.
 */
export interface ActivationResult {
  userId: string;
  activatedAt: Date;
}

/**
 * Returned by EmailDeliveryPort.sendTransactional().
 */
export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Recipient descriptor for outbound transactional email.
 */
export interface EmailRecipient {
  address: string;
  name: string;
}
