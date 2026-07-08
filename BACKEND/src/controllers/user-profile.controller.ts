/**
 * user-profile.controller.ts
 *
 * Entry point for GET /api/v1/users/me — returns the calling user's own
 * profile. Requires SessionValidationMiddleware to have populated req.userId.
 *
 * Error mapping:
 *   UserNotFoundException → 404 USER_NOT_FOUND
 *   unexpected             → 500
 */

import { Request, Response } from 'express';
import { UserProfileService } from '../services/user-profile.service';
import { UserNotFoundException } from '../errors/registration.errors';

export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  async getMe(req: Request, res: Response): Promise<void> {
    const userId = req.userId as string;

    try {
      const profile = await this.userProfileService.getProfile(userId);
      res.status(200).json({
        username: profile.username,
        email: profile.email,
        status: profile.status,
        registrationTimestamp: profile.registrationTimestamp.toISOString(),
        lastLoginAt: profile.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
        activeSessions: profile.activeSessions,
      });
    } catch (err) {
      if (err instanceof UserNotFoundException) {
        res.status(404).json({ error_code: 'USER_NOT_FOUND', message: err.message });
      } else {
        console.error('[UserProfileController] Unexpected error during getMe:', err);
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}
