import { Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { HealthController } from './health.controller';

function buildResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('HealthController', () => {
  let get: jest.Mock;
  let db: Database;
  let controller: HealthController;

  beforeEach(() => {
    get = jest.fn();
    db = { prepare: jest.fn().mockReturnValue({ get }) } as unknown as Database;
    controller = new HealthController(db);
  });

  test('DB reachable -> 200 { status: "ok", db_reachable: true }', async () => {
    get.mockReturnValue({ '1': 1 });
    const req = {} as Request;
    const res = buildResponse();

    await controller.check(req, res);

    expect(db.prepare).toHaveBeenCalledWith('SELECT 1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', db_reachable: true });
  });

  test('DB error -> still 200, db_reachable: false', async () => {
    get.mockImplementation(() => {
      throw new Error('connection refused');
    });
    const req = {} as Request;
    const res = buildResponse();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await controller.check(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', db_reachable: false });
    consoleErrorSpy.mockRestore();
  });
});
