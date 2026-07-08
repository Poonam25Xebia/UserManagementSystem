import { Request, Response } from 'express';
import { DeletionController } from './deletion.controller';
import { AccountDeletionService } from '../services/account-deletion.service';
import {
  AccountNotActiveException,
  DeletionRequestAlreadyPendingException,
  DeletionRequestNotFoundException,
  DeletionOtpExpiredException,
  DeletionOtpInvalidException,
} from '../errors/account-deletion.errors';

function buildRequest(overrides: { body?: unknown; userId?: string } = {}): Request {
  return {
    body: overrides.body ?? {},
    userId: overrides.userId,
  } as unknown as Request;
}

function buildResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('DeletionController', () => {
  let accountDeletionService: jest.Mocked<AccountDeletionService>;
  let controller: DeletionController;

  beforeEach(() => {
    accountDeletionService = {
      requestDeletion: jest.fn(),
      confirmDeletion: jest.fn(),
      cancelDeletion: jest.fn(),
    };
    controller = new DeletionController(accountDeletionService);
  });

  describe('requestDeletion', () => {
    test('happy path -> 202 with confirmation message', async () => {
      accountDeletionService.requestDeletion.mockResolvedValue({
        requestId: 'request-1',
        expiresAt: new Date('2026-01-02T00:00:00.000Z'),
      });
      const req = buildRequest({ userId: 'user-1' });
      const res = buildResponse();

      await controller.requestDeletion(req, res);

      expect(accountDeletionService.requestDeletion).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('confirmation code') }),
      );
    });

    test('AccountNotActiveException -> 403 AUTH_ACCOUNT_NOT_ACTIVE', async () => {
      accountDeletionService.requestDeletion.mockRejectedValue(
        new AccountNotActiveException('pending'),
      );
      const req = buildRequest({ userId: 'user-1' });
      const res = buildResponse();

      await controller.requestDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'AUTH_ACCOUNT_NOT_ACTIVE' }),
      );
    });

    test('DeletionRequestAlreadyPendingException -> 409 DELETION_REQUEST_ALREADY_PENDING', async () => {
      accountDeletionService.requestDeletion.mockRejectedValue(
        new DeletionRequestAlreadyPendingException('user-1'),
      );
      const req = buildRequest({ userId: 'user-1' });
      const res = buildResponse();

      await controller.requestDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'DELETION_REQUEST_ALREADY_PENDING' }),
      );
    });

    test('unexpected error -> generic 500', async () => {
      accountDeletionService.requestDeletion.mockRejectedValue(new Error('DB is down'));
      const req = buildRequest({ userId: 'user-1' });
      const res = buildResponse();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.requestDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('cancelDeletion', () => {
    test('happy path -> 200 with cancellation message', async () => {
      accountDeletionService.cancelDeletion.mockResolvedValue(undefined);
      const req = buildRequest({ userId: 'user-1' });
      const res = buildResponse();

      await controller.cancelDeletion(req, res);

      expect(accountDeletionService.cancelDeletion).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('cancelled') }),
      );
    });

    test('DeletionRequestNotFoundException -> 404 DELETION_REQUEST_NOT_FOUND', async () => {
      accountDeletionService.cancelDeletion.mockRejectedValue(
        new DeletionRequestNotFoundException('user-1'),
      );
      const req = buildRequest({ userId: 'user-1' });
      const res = buildResponse();

      await controller.cancelDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'DELETION_REQUEST_NOT_FOUND' }),
      );
    });

    test('unexpected error -> generic 500', async () => {
      accountDeletionService.cancelDeletion.mockRejectedValue(new Error('DB is down'));
      const req = buildRequest({ userId: 'user-1' });
      const res = buildResponse();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.cancelDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('confirmDeletion', () => {
    test('missing code -> 400, AccountDeletionService not called', async () => {
      const req = buildRequest({ body: {}, userId: 'user-1' });
      const res = buildResponse();

      await controller.confirmDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(accountDeletionService.confirmDeletion).not.toHaveBeenCalled();
    });

    test('happy path -> 200 with userId and deletedAt', async () => {
      accountDeletionService.confirmDeletion.mockResolvedValue({
        userId: 'user-1',
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const req = buildRequest({ body: { code: '123456' }, userId: 'user-1' });
      const res = buildResponse();

      await controller.confirmDeletion(req, res);

      expect(accountDeletionService.confirmDeletion).toHaveBeenCalledWith('user-1', '123456');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        userId: 'user-1',
        deletedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    test('DeletionRequestNotFoundException -> 404 DELETION_REQUEST_NOT_FOUND', async () => {
      accountDeletionService.confirmDeletion.mockRejectedValue(
        new DeletionRequestNotFoundException('user-1'),
      );
      const req = buildRequest({ body: { code: '123456' }, userId: 'user-1' });
      const res = buildResponse();

      await controller.confirmDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'DELETION_REQUEST_NOT_FOUND' }),
      );
    });

    test('DeletionOtpExpiredException -> 410 DELETION_OTP_EXPIRED', async () => {
      accountDeletionService.confirmDeletion.mockRejectedValue(
        new DeletionOtpExpiredException('user-1'),
      );
      const req = buildRequest({ body: { code: '123456' }, userId: 'user-1' });
      const res = buildResponse();

      await controller.confirmDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'DELETION_OTP_EXPIRED' }),
      );
    });

    test('DeletionOtpInvalidException -> 422 DELETION_OTP_INVALID', async () => {
      accountDeletionService.confirmDeletion.mockRejectedValue(
        new DeletionOtpInvalidException('user-1'),
      );
      const req = buildRequest({ body: { code: 'wrong' }, userId: 'user-1' });
      const res = buildResponse();

      await controller.confirmDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error_code: 'DELETION_OTP_INVALID' }),
      );
    });

    test('unexpected error -> generic 500', async () => {
      accountDeletionService.confirmDeletion.mockRejectedValue(new Error('DB is down'));
      const req = buildRequest({ body: { code: '123456' }, userId: 'user-1' });
      const res = buildResponse();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.confirmDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      consoleErrorSpy.mockRestore();
    });
  });
});
