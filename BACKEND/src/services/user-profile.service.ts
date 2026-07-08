/**
 * user-profile.service.ts
 *
 * Backs GET /api/v1/users/me: returns the calling (session-authenticated)
 * user's own profile plus their current active-session count.
 */

import { IUserRepository } from '../repositories/user.repository';
import { ISessionRepository } from '../repositories/session.repository';
import { UserProfileResult } from '../types/user-profile.types';
import { UserNotFoundException } from '../errors/registration.errors';

export interface UserProfileService {
  getProfile(userId: string): Promise<UserProfileResult>;
}

export class DefaultUserProfileService implements UserProfileService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  /**
   * @throws UserNotFoundException - the session's owning user record is gone
   *         (shouldn't happen in the normal path — SessionValidationMiddleware
   *         already resolved this userId from a valid session).
   */
  async getProfile(userId: string): Promise<UserProfileResult> {
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new UserNotFoundException(userId);
    }

    const activeSessions = await this.sessionRepository.countActiveForUser(userId);

    return {
      username: user.username,
      email: user.email,
      status: user.status,
      registrationTimestamp: user.registrationTimestamp,
      lastLoginAt: user.lastLoginAt,
      activeSessions,
    };
  }
}
