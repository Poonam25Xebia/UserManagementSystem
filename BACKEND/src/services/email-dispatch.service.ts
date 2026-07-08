/**
 * email-dispatch.service.ts
 *
 * Service for enqueueing and re-enqueueing confirmation emails via the
 * transactional outbox (registration_email_records table).
 *
 * Responsibilities:
 *  - enqueueConfirmationEmail: inserts a queued outbox record for a pending user.
 *  - resendConfirmation: admin-triggered re-enqueue for a pending user.
 *  - Guards against duplicate queued records (FR-010).
 *
 * Requirements: US-073 FR-011, FR-013
 */

import { IUserRepository } from '../repositories/user.repository';
import { IEmailRecordRepository } from '../repositories/email-record.repository';
import { ITokenRepository } from '../repositories/token.repository';
import {
  UserNotFoundException,
  AccountNotPendingException,
  DuplicateDispatchException,
} from '../errors/registration.errors';

export interface EmailDispatchService {
  enqueueConfirmationEmail(userId: string): Promise<void>;
  resendConfirmation(userId: string): Promise<void>;
}

export class DefaultEmailDispatchService implements EmailDispatchService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailRecordRepository: IEmailRecordRepository,
    private readonly tokenRepository: ITokenRepository,
  ) {}

  /**
   * Enqueue a confirmation email for a newly registered (pending) user.
   * Called internally after account creation.
   *
   * Throws DuplicateDispatchException if a queued record already exists.
   */
  async enqueueConfirmationEmail(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (user === null) {
      throw new UserNotFoundException(userId);
    }

    if (user.status !== 'pending') {
      throw new AccountNotPendingException(user.status);
    }

    // Guard against duplicate dispatch (FR-010)
    const existing = await this.emailRecordRepository.findByUserId(userId);
    if (existing !== null && existing.deliveryStatus === 'queued') {
      throw new DuplicateDispatchException(userId);
    }

    // Resolve the user's activation token for the outbox record
    const token = await this.tokenRepository.findByUserId(userId);
    const activationTokenId = token?.id ?? '';

    await this.emailRecordRepository.insert({
      userId,
      recipientAddress: user.email,
      dispatchTimestamp: new Date(),
      deliveryStatus: 'queued',
      retryCount: 0,
      activationTokenId,
    });
  }

  /**
   * Admin-triggered re-enqueue of the confirmation email.
   * Inserts a new queued outbox record regardless of prior delivery history.
   *
   * Throws UserNotFoundException  — user does not exist.
   * Throws AccountNotPendingException — account is not in pending state.
   */
  async resendConfirmation(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (user === null) {
      throw new UserNotFoundException(userId);
    }

    if (user.status !== 'pending') {
      throw new AccountNotPendingException(user.status);
    }

    const token = await this.tokenRepository.findByUserId(userId);
    const activationTokenId = token?.id ?? '';

    // Insert a new queued record (admin resend always creates a fresh record)
    await this.emailRecordRepository.insert({
      userId,
      recipientAddress: user.email,
      dispatchTimestamp: new Date(),
      deliveryStatus: 'queued',
      retryCount: 0,
      activationTokenId,
    });
  }
}
