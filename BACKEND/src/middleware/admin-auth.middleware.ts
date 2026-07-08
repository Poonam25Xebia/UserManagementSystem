import { Request, Response, NextFunction } from 'express';
import { appConfig } from '../config/app.config';

const BEARER_PREFIX = 'Bearer ';

export function requireAdminBearerToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const rawAuthorization = req.header('authorization');

  if (!rawAuthorization || typeof rawAuthorization !== 'string') {
    res.status(401).json({ error: 'Authorization header is required.' });
    return;
  }

  if (!rawAuthorization.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: 'Authorization header must use Bearer scheme.' });
    return;
  }

  const token = rawAuthorization.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Bearer token is required.' });
    return;
  }

  if (token !== appConfig.adminBearerToken) {
    res.status(403).json({ error: 'Insufficient permissions to access this resource.' });
    return;
  }

  next();
}
