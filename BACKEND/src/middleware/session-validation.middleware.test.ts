import { Request, Response } from 'express';
import { createSessionValidationMiddleware } from './session-validation.middleware';
import { SessionService } from '../services/session.service';

function buildRequest(authorizationHeader: string | undefined): Request {
  return {
    header: jest.fn((name: string) => {
      if (name.toLowerCase() === 'authorization') return authorizationHeader;
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

describe('sessionValidationMiddleware', () => {
  let sessionService: jest.Mocked<SessionService>;
  let next: jest.Mock;
  let middleware: ReturnType<typeof createSessionValidationMiddleware>;

  beforeEach(() => {
    sessionService = {
      createSession: jest.fn(),
      validateSession: jest.fn(),
      invalidateSession: jest.fn(),
      invalidateAllForUser: jest.fn(),
    };
    next = jest.fn();
    middleware = createSessionValidationMiddleware(sessionService);
  });

  test('missing Authorization header -> 401, next() not called', async () => {
    const req = buildRequest(undefined);
    const res = buildResponse();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_HEADER_MISSING' }),
    );
    expect(sessionService.validateSession).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('Authorization header missing Bearer scheme -> 401, next() not called', async () => {
    const req = buildRequest('Basic somecredentials');
    const res = buildResponse();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_HEADER_MALFORMED' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('Bearer scheme with empty token -> 401, next() not called', async () => {
    const req = buildRequest('Bearer    ');
    const res = buildResponse();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_HEADER_MALFORMED' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('not-found session -> 401 SESSION_NOT_FOUND, next() not called', async () => {
    sessionService.validateSession.mockResolvedValue({ valid: false, reason: 'NOT_FOUND' });
    const req = buildRequest('Bearer some-token');
    const res = buildResponse();

    await middleware(req, res, next);

    expect(sessionService.validateSession).toHaveBeenCalledWith('some-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'SESSION_NOT_FOUND' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('expired session -> 401 SESSION_EXPIRED, next() not called', async () => {
    sessionService.validateSession.mockResolvedValue({ valid: false, reason: 'EXPIRED' });
    const req = buildRequest('Bearer some-token');
    const res = buildResponse();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'SESSION_EXPIRED' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('invalidated session -> 401 SESSION_INVALIDATED, next() not called', async () => {
    sessionService.validateSession.mockResolvedValue({ valid: false, reason: 'INVALIDATED' });
    const req = buildRequest('Bearer some-token');
    const res = buildResponse();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'SESSION_INVALIDATED' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('suspended account (still-unexpired token) -> 403 AUTH_ACCOUNT_NOT_ACTIVE, next() not called', async () => {
    // Cascade invalidation of the user's sessions happens inside SessionService
    // itself (covered by session.service.test.ts); the middleware only needs
    // to map the ACCOUNT_SUSPENDED reason to the correct HTTP response.
    sessionService.validateSession.mockResolvedValue({ valid: false, reason: 'ACCOUNT_SUSPENDED' });
    const req = buildRequest('Bearer some-token');
    const res = buildResponse();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_ACCOUNT_NOT_ACTIVE' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('valid session -> req.userId populated, next() called exactly once', async () => {
    sessionService.validateSession.mockResolvedValue({ valid: true, userId: 'user-42' });
    const req = buildRequest('Bearer some-token');
    const res = buildResponse();

    await middleware(req, res, next);

    expect(req.userId).toBe('user-42');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
