import { Request, Response } from 'express';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from '../services/user-profile.service';
import { UserNotFoundException } from '../errors/registration.errors';

function buildRequest(userId: string): Request {
  return { userId } as unknown as Request;
}

function buildResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('UserProfileController', () => {
  let userProfileService: jest.Mocked<UserProfileService>;
  let controller: UserProfileController;

  beforeEach(() => {
    userProfileService = { getProfile: jest.fn() };
    controller = new UserProfileController(userProfileService);
  });

  test('happy path -> 200 with the profile, dates serialized to ISO strings', async () => {
    userProfileService.getProfile.mockResolvedValue({
      username: 'jdoe',
      email: 'jdoe@example.test',
      status: 'active',
      registrationTimestamp: new Date('2026-01-01T00:00:00.000Z'),
      lastLoginAt: new Date('2026-01-02T00:00:00.000Z'),
      activeSessions: 2,
    });
    const req = buildRequest('user-1');
    const res = buildResponse();

    await controller.getMe(req, res);

    expect(userProfileService.getProfile).toHaveBeenCalledWith('user-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      username: 'jdoe',
      email: 'jdoe@example.test',
      status: 'active',
      registrationTimestamp: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-01-02T00:00:00.000Z',
      activeSessions: 2,
    });
  });

  test('lastLoginAt null -> serialized as null, not a crash', async () => {
    userProfileService.getProfile.mockResolvedValue({
      username: 'jdoe',
      email: 'jdoe@example.test',
      status: 'pending',
      registrationTimestamp: new Date('2026-01-01T00:00:00.000Z'),
      lastLoginAt: null,
      activeSessions: 0,
    });
    const req = buildRequest('user-1');
    const res = buildResponse();

    await controller.getMe(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ lastLoginAt: null }),
    );
  });

  test('UserNotFoundException -> 404 USER_NOT_FOUND', async () => {
    userProfileService.getProfile.mockRejectedValue(new UserNotFoundException('user-1'));
    const req = buildRequest('user-1');
    const res = buildResponse();

    await controller.getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'USER_NOT_FOUND' }),
    );
  });

  test('unexpected error -> generic 500', async () => {
    userProfileService.getProfile.mockRejectedValue(new Error('DB is down'));
    const req = buildRequest('user-1');
    const res = buildResponse();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await controller.getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    consoleErrorSpy.mockRestore();
  });
});
