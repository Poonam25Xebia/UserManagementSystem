/**
 * registration.controller.ts
 *
 * Entry point for POST /api/v1/users/register.
 * Orchestrates the full validation pipeline and delegates to RegistrationService.
 *
 * Pipeline order (per design.md):
 *   1. Mandatory fields (presence + email format + password match)
 *   2. Email format (structural regex)
 *   3. Password policy (complexity rules)
 *   4. Username uniqueness (DB check)
 *   5. Register (atomic DB inserts)
 *
 * Requirements: US-062 FR-001–002, US-063 FR-001/FR-008, US-064 FR-004–005,
 *               US-065 FR-009/FR-012, US-073 FR-001–002
 */

import { Request, Response } from 'express';
import { RegistrationValidator } from '../validators/registration.validator';
import { EmailValidator } from '../validators/email.validator';
import { PasswordPolicyEvaluator } from '../validators/password-policy.evaluator';
import { UsernameUniquenessValidator } from '../validators/username-uniqueness.validator';
import { RegistrationService } from '../services/registration.service';
import { OtpService } from '../services/otp.service';
import { RegistrationRequestDto } from '../types/registration.types';
import { ValidationError, UsernameConflictError } from '../errors/registration.errors';
import { passwordPolicyConfig } from '../config/password-policy.config';

export class RegistrationController {
  constructor(
    private readonly mandatoryFieldsValidator: RegistrationValidator,
    private readonly emailValidator: EmailValidator,
    private readonly passwordPolicyEvaluator: PasswordPolicyEvaluator,
    private readonly usernameValidator: UsernameUniquenessValidator,
    private readonly registrationService: RegistrationService,
    private readonly otpService: OtpService,
  ) {}

  /**
   * Handle POST /api/v1/users/register
   */
  async registerUser(req: Request, res: Response): Promise<void> {
    // --- Parse request body ---
    const dto: RegistrationRequestDto = {
      username: req.body.username as string,
      emailAddress: req.body.emailAddress as string,
      password: req.body.password as string,
      passwordConfirmation: req.body.passwordConfirmation as string,
    };

    // --- Stage 1: Mandatory fields validation (US-065) ---
    const validationResult = this.mandatoryFieldsValidator.validate(dto);
    if (!validationResult.isValid) {
      res.status(422).json({ isValid: false, fieldErrors: validationResult.fieldErrors });
      return;
    }

    // --- Stage 2: Email format validation (US-062) ---
    try {
      this.emailValidator.validateFormat(dto.emailAddress);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(422).json({
          isValid: false,
          fieldErrors: [{ fieldName: 'emailAddress', errorMessage: err.message }],
        });
        return;
      }
      throw err;
    }

    // --- Stage 3: Password policy evaluation (US-063) ---
    const pwResult = this.passwordPolicyEvaluator.evaluate(dto.password, passwordPolicyConfig);
    if (!pwResult.valid) {
      res.status(422).json({ error: 'PASSWORD_POLICY_VIOLATION', violations: pwResult.violations });
      return;
    }

    // --- Stage 4: Username uniqueness check (US-064) ---
    try {
      await this.usernameValidator.checkUniqueness(dto.username);
    } catch (err) {
      if (err instanceof UsernameConflictError) {
        res.status(409).json({
          error_code: 'USERNAME_UNAVAILABLE',
          message: err.message,
          field: 'username',
          suggestion_hint: 'Please choose a different username.',
        });
        return;
      }
      throw err;
    }

    // --- Stage 5: Register user (US-073) ---
    try {
      const result = await this.registrationService.register(dto);

      // Dispatch the activation OTP email. OtpService never throws on
      // dispatch failure (it records status 'failed' for observability and
      // still resolves), so registration always returns 201 once the user
      // row is committed.
      await this.otpService.sendOtp(result.userId);

      res.status(201).json({ userId: result.userId, message: result.message });
    } catch (err) {
      if (err instanceof UsernameConflictError) {
        res.status(409).json({
          error_code: 'USERNAME_UNAVAILABLE',
          message: err.message,
          field: 'username',
          suggestion_hint: 'Please choose a different username.',
        });
        return;
      }

      console.error('Registration failed:', err);
      res.status(500).json({ error: 'An unexpected error occurred during registration.' });
    }
  }
}
