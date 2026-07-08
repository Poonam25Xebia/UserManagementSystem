/**
 * registration.errors.ts
 *
 * Custom domain error classes for the User Registration Feature (F-01).
 * All errors extend the built-in Error class so they are instanceof-compatible
 * with standard JS error handling.
 */

// ---------------------------------------------------------------------------
// Generic validation error (carries a machine-readable code)
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ValidationError';
    // Restore prototype chain (required when extending built-in classes in ES5 targets).
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Username uniqueness (US-064)
// ---------------------------------------------------------------------------

export class UsernameConflictError extends Error {
  public readonly username: string;

  constructor(username: string) {
    super(`The username '${username}' is already in use.`);
    this.name = 'UsernameConflictError';
    this.username = username;
    Object.setPrototypeOf(this, UsernameConflictError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Activation token errors (US-074)
// ---------------------------------------------------------------------------

export class TokenNotFoundException extends Error {
  constructor() {
    super('The provided activation token was not found.');
    this.name = 'TokenNotFoundException';
    Object.setPrototypeOf(this, TokenNotFoundException.prototype);
  }
}

export class TokenExpiredException extends Error {
  constructor() {
    super('The activation token has expired. Please request a new one.');
    this.name = 'TokenExpiredException';
    Object.setPrototypeOf(this, TokenExpiredException.prototype);
  }
}

export class TokenConsumedException extends Error {
  constructor() {
    super('The activation token has already been used.');
    this.name = 'TokenConsumedException';
    Object.setPrototypeOf(this, TokenConsumedException.prototype);
  }
}

// ---------------------------------------------------------------------------
// Account state errors
// ---------------------------------------------------------------------------

export class AccountNotPendingException extends Error {
  public readonly accountStatus: string;

  constructor(status: string) {
    super(`Account activation requires 'pending' status, but current status is '${status}'.`);
    this.name = 'AccountNotPendingException';
    this.accountStatus = status;
    Object.setPrototypeOf(this, AccountNotPendingException.prototype);
  }
}

// ---------------------------------------------------------------------------
// Email dispatch errors (US-073)
// ---------------------------------------------------------------------------

/**
 * Thrown when an attempt is made to dispatch a confirmation email for a user
 * that already has an outstanding (queued) outbox record.
 */
export class DuplicateDispatchException extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super(`A confirmation email dispatch record already exists for user '${userId}'.`);
    this.name = 'DuplicateDispatchException';
    this.userId = userId;
    Object.setPrototypeOf(this, DuplicateDispatchException.prototype);
  }
}

/**
 * Thrown when an operation targets a user that does not exist in the system.
 */
export class UserNotFoundException extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super(`User with id '${userId}' was not found.`);
    this.name = 'UserNotFoundException';
    this.userId = userId;
    Object.setPrototypeOf(this, UserNotFoundException.prototype);
  }
}
