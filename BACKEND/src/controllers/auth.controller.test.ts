import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import {
  InvalidCredentialsException,
  AccountNotActiveException,
  AccountLockedException,
  SessionCreationFailedException,
} from '../errors/login.errors';

function buildRequest(overrides: { body?: unknown; authorization?: string } = {}): Request {
  return {
    body: overrides.body ?? {},
    header: jest.fn((name: string) => {
      if (name.toLowerCase() === 'authorization') return overrides.authorization;
      return undefined;
    }),
  } as unknown as Request;
}

function buildResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AuthController', () => {
  let authService: jest.Mocked<AuthService>;
  let sessionService: jest.Mocked<SessionService>;
  let controller: AuthController;

  beforeEach(() => {
    authService = { login: jest.fn() };
    sessionService = {
      createSession: jest.fn(),
      validateSession: jest.fn(),
      invalidateSession: jest.fn(),
      invalidateAllForUser: jest.fn(),
    };
    controller = new AuthController(authService, sessionService);
  });

  describe('login', () => {
    test('missing email -> 400, AuthService not called', async () => {
      const req = buildRequest({ body: { password: 'secret' } });
      const res = buildResponse();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(authService.login).not.toHaveBeenCalled();
    });

    test('missing password -> 400, AuthService not called', async () => {
      const req = buildRequest({ body: { email: 'jdoe@example.test' } });
      const res = buildResponse();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(authService.login).not.toHaveBeenCalled();
    });

    test('happy path -> 200 with token and expires_at', async () => {
      authService.login.mockResolvedValue({
        token: 'raw-token-value',
        expiresAt: new Date('2026-01-01T01:00:00.000Z'),
      });
      const req = buildRequest({ body: { email: 'jdoe@example.test', password: 'correct-password' } });
      const res = buildResponse();

      await controller.login(req, res);

      expect(authService.login).toHaveBeenCalledWith('jdoe@example.test', 'correct-password');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        token: 'raw-token-value',
        expires_at: '2026-01-01T01:00:00.000Z',
      });
    });

    test('InvalidCredentialsException -> 401 AUTH_INVALID_CREDENTIALS', async () => {
      authService.login.mockRejectedValue(new InvalidCredentialsException());
      const req = buildRequest({ body: { email: 'jdoe@example.test', password: 'wrong' } });
      const res = buildResponse();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'AUTH_INVALID_CREDENTIALS' }),
      );
    });

    test('AccountNotActiveException -> 403 AUTH_ACCOUNT_NOT_ACTIVE', async () => {
      authService.login.mockRejectedValue(new AccountNotActiveException('pending'));
      const req = buildRequest({ body: { email: 'jdoe@example.test', password: 'whatever' } });
      const res = buildResponse();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'AUTH_ACCOUNT_NOT_ACTIVE' }),
      );
    });

    test('AccountLockedException -> 423 AUTH_ACCOUNT_LOCKED with retry_after', async () => {
      const retryAfter = new Date('2026-01-01T02:00:00.000Z');
      authService.login.mockRejectedValue(new AccountLockedException(retryAfter));
      const req = buildRequest({ body: { email: 'jdoe@example.test', password: 'whatever' } });
      const res = buildResponse();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(423);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error_code: 'AUTH_ACCOUNT_LOCKED',
          retry_after: '2026-01-01T02:00:00.000Z',
        }),
      );
    });

    test('SessionCreationFailedException -> 500 SESSION_CREATION_FAILED', async () => {
      authService.login.mockRejectedValue(new SessionCreationFailedException());
      const req = buildRequest({ body: { email: 'jdoe@example.test', password: 'correct-password' } });
      const res = buildResponse();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'SESSION_CREATION_FAILED' }),
      );
    });

    test('unexpected error -> generic 500', async () => {
      authService.login.mockRejectedValue(new Error('DB is down'));
      const req = buildRequest({ body: { email: 'jdoe@example.test', password: 'correct-password' } });
      const res = buildResponse();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('logout', () => {
    test('missing Authorization header -> 401, SessionService not called', async () => {
      const req = buildRequest({ authorization: undefined });
      const res = buildResponse();

      await controller.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(sessionService.invalidateSession).not.toHaveBeenCalled();
    });

    test('Authorization header missing Bearer scheme -> 401', async () => {
      const req = buildRequest({ authorization: 'Basic somecreds' });
      const res = buildResponse();

      await controller.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(sessionService.invalidateSession).not.toHaveBeenCalled();
    });

    test('valid, active session -> 200 Logged out.', async () => {
      sessionService.invalidateSession.mockResolvedValue({ alreadyTerminated: false });
      const req = buildRequest({ authorization: 'Bearer some-token' });
      const res = buildResponse();

      await controller.logout(req, res);

      expect(sessionService.invalidateSession).toHaveBeenCalledWith('some-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logged out.' });
    });

    test('expired token -> still 200 Logged out. (idempotent, EC-005)', async () => {
      sessionService.invalidateSession.mockResolvedValue({ alreadyTerminated: true });
      const req = buildRequest({ authorization: 'Bearer expired-token' });
      const res = buildResponse();

      await controller.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logged out.' });
    });

    test('already-invalidated token -> still 200 Logged out. (idempotent, EC-005)', async () => {
      sessionService.invalidateSession.mockResolvedValue({ alreadyTerminated: true });
      const req = buildRequest({ authorization: 'Bearer already-invalidated-token' });
      const res = buildResponse();

      await controller.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logged out.' });
    });
  });
});
