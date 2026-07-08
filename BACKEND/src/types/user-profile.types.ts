/**
 * user-profile.types.ts
 *
 * Result type returned by UserProfileService.getProfile() — backs
 * GET /api/v1/users/me.
 */

export interface UserProfileResult {
  username: string;
  email: string;
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  registrationTimestamp: Date;
  lastLoginAt: Date | null;
  activeSessions: number;
}
