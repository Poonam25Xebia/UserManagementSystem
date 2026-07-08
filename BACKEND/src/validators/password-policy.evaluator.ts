/**
 * password-policy.evaluator.ts
 *
 * Pure, side-effect-free evaluator for password complexity rules.
 * Implements FR-001 through FR-012 from the registration requirements.
 */

import { PasswordPolicy, PasswordValidationResult } from '../types/registration.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PasswordPolicyEvaluator {
  evaluate(password: string, policy: PasswordPolicy): PasswordValidationResult;
}

// ---------------------------------------------------------------------------
// Default implementation
// ---------------------------------------------------------------------------

export class DefaultPasswordPolicyEvaluator implements PasswordPolicyEvaluator {
  /**
   * Evaluates `password` against `policy` and returns a result containing
   * whether the password is valid and any violations found.
   *
   * Evaluation order (deterministic):
   *   1. Null/empty guard  — returns immediately (FR-009)
   *   2. Maximum-length guard — returns immediately (FR-011)
   *   3. All remaining rules collected in a single pass (FR-010, FR-012)
   */
  evaluate(password: string, policy: PasswordPolicy): PasswordValidationResult {
    // 1. Null / undefined / blank guard (FR-009)
    if (password == null || password.trim() === '') {
      return { valid: false, violations: ['Password is required.'] };
    }

    // 2. Maximum-length guard — short-circuit before char-class checks (FR-011)
    if (password.length > policy.maximumLength) {
      return {
        valid: false,
        violations: [
          `Password exceeds maximum length of ${policy.maximumLength} characters.`,
        ],
      };
    }

    // 3. Collect all remaining violations in deterministic order (FR-010, FR-012)
    const violations: string[] = [];

    // 3a. Minimum length
    if (password.length < policy.minimumLength) {
      violations.push(
        `Password must be at least ${policy.minimumLength} characters.`,
      );
    }

    // 3b. Uppercase requirement
    if (policy.requiresUppercase && !/[A-Z]/.test(password)) {
      violations.push('Password must contain at least one uppercase letter.');
    }

    // 3c. Lowercase requirement
    if (policy.requiresLowercase && !/[a-z]/.test(password)) {
      violations.push('Password must contain at least one lowercase letter.');
    }

    // 3d. Digit requirement
    if (policy.requiresDigit && !/[0-9]/.test(password)) {
      violations.push('Password must contain at least one numeric digit.');
    }

    // 3e. Special character requirement
    if (policy.requiresSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) {
      violations.push('Password must contain at least one special character.');
    }

    return { valid: violations.length === 0, violations };
  }
}
