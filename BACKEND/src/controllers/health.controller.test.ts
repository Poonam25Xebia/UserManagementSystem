import { Request, Response } from 'express';
import { Pool } from 'pg';
import { HealthController } from './health.controller';

function buildResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('HealthController', () => {
  let query: jest.Mock;
  let pool: Pool;
  let controller: HealthController;

  beforeEach(() => {
    query = jest.fn();
    pool = { query } as unknown as Pool;
    controller = new HealthController(pool);
  });

  test('DB reachable -> 200 { status: "ok", db_reachable: true }', async () => {
    query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const req = {} as Request;
    const res = buildResponse();

    await controller.check(req, res);

    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', db_reachable: true });
  });

  test('DB error -> still 200, db_reachable: false', async () => {
    query.mockRejectedValue(new Error('connection refused'));
    const req = {} as Request;
    const res = buildResponse();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await controller.check(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', db_reachable: false });
    consoleErrorSpy.mockRestore();
  });
});
