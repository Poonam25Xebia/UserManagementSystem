import { Request, Response } from 'express';
import { PasswordController } from './password.controller';
import { PasswordRecoveryService } from '../services/password-recovery.service';
import {
  TokenNotFoundException,
  TokenExpiredException,
  PasswordPolicyViolationException,
} from '../errors/login.errors';

function buildRequest(body: unknown): Request {
  return { body } as unknown as Request;
}

function buildResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('PasswordController', () => {
  let passwordRecoveryService: jest.Mocked<PasswordRecoveryService>;
  let controller: PasswordController;

  beforeEach(() => {
    passwordRecoveryService = {
      requestRecovery: jest.fn(),
      resetPassword: jest.fn(),
    };
    controller = new PasswordController(passwordRecoveryService);
  });

  describe('requestRecovery', () => {
    test('missing email -> 400, service not called', async () => {
      const req = buildRequest({});
      const res = buildResponse();

      await controller.requestRecovery(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(passwordRecoveryService.requestRecovery).not.toHaveBeenCalled();
    });

    test('existing email -> 202 with generic message', async () => {
      passwordRecoveryService.requestRecovery.mockResolvedValue(undefined);
      const req = buildRequest({ email: 'jdoe@example.test' });
      const res = buildResponse();

      await controller.requestRecovery(req, res);

      expect(passwordRecoveryService.requestRecovery).toHaveBeenCalledWith('jdoe@example.test');
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If that email is registered, a recovery link has been sent.',
      });
    });

    test('non-existing email -> byte-identical 202 response to the existing-email case', async () => {
      passwordRecoveryService.requestRecovery.mockResolvedValue(undefined);
      const req = buildRequest({ email: 'unknown@example.test' });
      const res = buildResponse();

      await controller.requestRecovery(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If that email is registered, a recovery link has been sent.',
      });
    });

    test('service throwing an infrastructure error still returns 202 (no enumeration signal)', async () => {
      passwordRecoveryService.requestRecovery.mockRejectedValue(new Error('DB unavailable'));
      const req = buildRequest({ email: 'jdoe@example.test' });
      const res = buildResponse();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.requestRecovery(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If that email is registered, a recovery link has been sent.',
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe('resetPassword', () => {
    test('missing recovery_token -> 400, service not called', async () => {
      const req = buildRequest({ new_password: 'NewP@ss1' });
      const res = buildResponse();

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(passwordRecoveryService.resetPassword).not.toHaveBeenCalled();
    });

    test('missing new_password -> 400, service not called', async () => {
      const req = buildRequest({ recovery_token: 'some-token' });
      const res = buildResponse();

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(passwordRecoveryService.resetPassword).not.toHaveBeenCalled();
    });

    test('happy path -> 200 with confirmation message', async () => {
      passwordRecoveryService.resetPassword.mockResolvedValue(undefined);
      const req = buildRequest({ recovery_token: 'valid-token', new_password: 'NewP@ss1' });
      const res = buildResponse();

      await controller.resetPassword(req, res);

      expect(passwordRecoveryService.resetPassword).toHaveBeenCalledWith('valid-token', 'NewP@ss1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password has been reset. Please log in again.',
      });
    });

    test('TokenNotFoundException -> 404 TOKEN_NOT_FOUND', async () => {
      passwordRecoveryService.resetPassword.mockRejectedValue(new TokenNotFoundException());
      const req = buildRequest({ recovery_token: 'unknown-token', new_password: 'NewP@ss1' });
      const res = buildResponse();

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'TOKEN_NOT_FOUND' }),
      );
    });

    test('TokenExpiredException -> 410 TOKEN_EXPIRED (reconciled, not 400)', async () => {
      passwordRecoveryService.resetPassword.mockRejectedValue(new TokenExpiredException());
      const req = buildRequest({ recovery_token: 'expired-token', new_password: 'NewP@ss1' });
      const res = buildResponse();

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'TOKEN_EXPIRED' }),
      );
    });

    test('PasswordPolicyViolationException -> 422 with violations array', async () => {
      const violations = ['Password must be at least 8 characters.'];
      passwordRecoveryService.resetPassword.mockRejectedValue(
        new PasswordPolicyViolationException(violations),
      );
      const req = buildRequest({ recovery_token: 'valid-token', new_password: 'weak' });
      const res = buildResponse();

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        error_code: 'PASSWORD_POLICY_VIOLATION',
        violations,
      });
    });

    test('unexpected error -> generic 500', async () => {
      passwordRecoveryService.resetPassword.mockRejectedValue(new Error('DB is down'));
      const req = buildRequest({ recovery_token: 'valid-token', new_password: 'NewP@ss1' });
      const res = buildResponse();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      consoleErrorSpy.mockRestore();
    });
  });
});
