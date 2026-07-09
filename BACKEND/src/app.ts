import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import type { Database } from 'better-sqlite3';
import { Redis } from 'ioredis';
import { createRegistrationRouter } from './routes/registration.routes';
import { createActivationRouter } from './routes/activation.routes';
import { createAdminRouter } from './routes/admin.routes';
import { createOtpRouter } from './routes/otp.routes';
import { createAuthRouter } from './routes/auth.routes';
import { createPasswordRouter } from './routes/password.routes';
import { createDeletionRouter } from './routes/deletion.routes';
import { createUserProfileRouter } from './routes/user-profile.routes';
import { createHealthRouter } from './routes/health.routes';
import { OtpDeliveryPort } from './adapters/otp-delivery.port';
import { EmailDeliveryPort } from './adapters/email-delivery.port';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { DefaultSessionService } from './services/session.service';
import {
  ValidationError,
  UsernameConflictError,
  TokenNotFoundException,
  TokenExpiredException,
  TokenConsumedException,
  AccountNotPendingException,
  DuplicateDispatchException,
  UserNotFoundException,
} from './errors/registration.errors';
import {
  InvalidCredentialsException,
  AccountNotActiveException,
  AccountLockedException,
  SessionCreationFailedException,
  SessionNotFoundException,
  SessionExpiredException,
  SessionInvalidatedException,
  PasswordPolicyViolationException,
} from './errors/login.errors';
import {
  DeletionRequestAlreadyPendingException,
  DeletionRequestNotFoundException,
} from './errors/account-deletion.errors';

function createAppErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ValidationError) {
    res.status(422).json({ errorCode: err.code, message: err.message });
    return;
  }

  if (err instanceof UsernameConflictError) {
    res.status(409).json({ errorCode: 'USERNAME_CONFLICT', message: err.message });
    return;
  }

  if (err instanceof TokenNotFoundException) {
    res.status(404).json({ errorCode: 'TOKEN_NOT_FOUND', message: err.message });
    return;
  }

  if (err instanceof TokenExpiredException) {
    res.status(410).json({ errorCode: 'TOKEN_EXPIRED', message: err.message });
    return;
  }

  if (err instanceof TokenConsumedException) {
    res.status(410).json({ errorCode: 'TOKEN_CONSUMED', message: err.message });
    return;
  }

  if (err instanceof AccountNotPendingException) {
    res.status(409).json({ errorCode: 'ACCOUNT_NOT_PENDING', message: err.message });
    return;
  }

  if (err instanceof DuplicateDispatchException) {
    res.status(409).json({ errorCode: 'DUPLICATE_DISPATCH', message: err.message });
    return;
  }

  if (err instanceof UserNotFoundException) {
    res.status(404).json({ errorCode: 'USER_NOT_FOUND', message: err.message });
    return;
  }

  // --- F-03: User Login exception types ---
  // Defense-in-depth: AuthController/PasswordController/SessionValidationMiddleware
  // already catch and translate these directly, so in the normal path this
  // handler is never reached for them — these cases guard against a future
  // caller that forgets to catch, or a rejection that escapes a try/catch.

  if (err instanceof InvalidCredentialsException) {
    res.status(401).json({ errorCode: 'AUTH_INVALID_CREDENTIALS', message: err.message });
    return;
  }

  if (err instanceof AccountNotActiveException) {
    res.status(403).json({ errorCode: 'AUTH_ACCOUNT_NOT_ACTIVE', message: err.message });
    return;
  }

  if (err instanceof AccountLockedException) {
    res.status(423).json({
      errorCode: 'AUTH_ACCOUNT_LOCKED',
      message: err.message,
      retry_after: err.retryAfter.toISOString(),
    });
    return;
  }

  if (err instanceof SessionCreationFailedException) {
    res.status(500).json({ errorCode: 'SESSION_CREATION_FAILED', message: err.message });
    return;
  }

  if (err instanceof SessionNotFoundException) {
    res.status(401).json({ errorCode: 'SESSION_NOT_FOUND', message: err.message });
    return;
  }

  if (err instanceof SessionExpiredException) {
    res.status(401).json({ errorCode: 'SESSION_EXPIRED', message: err.message });
    return;
  }

  if (err instanceof SessionInvalidatedException) {
    res.status(401).json({ errorCode: 'SESSION_INVALIDATED', message: err.message });
    return;
  }

  if (err instanceof PasswordPolicyViolationException) {
    res.status(422).json({ errorCode: 'PASSWORD_POLICY_VIOLATION', violations: err.violations });
    return;
  }

  // --- F-04: Account Deletion exception types ---
  // Defense-in-depth: DeletionController already catches and translates
  // these directly, so in the normal path this handler is never reached for
  // them — these cases guard against a future caller that forgets to catch.

  if (err instanceof DeletionRequestAlreadyPendingException) {
    res.status(409).json({ errorCode: 'DELETION_REQUEST_ALREADY_PENDING', message: err.message });
    return;
  }

  if (err instanceof DeletionRequestNotFoundException) {
    res.status(404).json({ errorCode: 'DELETION_REQUEST_NOT_FOUND', message: err.message });
    return;
  }

  console.error('[GlobalErrorHandler] Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
}

export function createApp(
  db: Database,
  redis: Redis,
  otpDeliveryPort: OtpDeliveryPort,
  emailDeliveryPort: EmailDeliveryPort,
) {
  const app = express();

  // CORS — no frontend origin is fixed yet, so reflect the request origin by
  // default (safe here: auth is Bearer-token based, not cookie-based, so
  // there is no CSRF surface). Set FRONTEND_ORIGIN to lock this down once a
  // frontend deployment URL is known.
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.trim() || true }));

  app.use(express.json());

  app.use('/api/v1/users', createRegistrationRouter(db, redis, otpDeliveryPort));
  app.use('/api/v1/users', createActivationRouter(db));
  app.use('/api/v1/admin', createAdminRouter(db));
  app.use('/api/v1/otp', createOtpRouter(db, redis, otpDeliveryPort));

  // F-03: User Login — /login, /logout, /password-recovery, /password-reset
  // are all pre-auth by nature (the credential/token IS the auth mechanism),
  // so no SessionValidationMiddleware is applied to this router.
  app.use('/api/v1/auth', createAuthRouter(db));
  app.use('/api/v1/auth', createPasswordRouter(db, emailDeliveryPort));

  // F-04: Account Deletion — the first consumer of SessionValidationMiddleware
  // as the cross-cutting guard it was built to be (US-038 A-003). All three
  // deletion-request routes are authenticated, including /confirm — the OTP
  // code is checked against the caller's own pending request, not looked up
  // as a global unauthenticated credential.
  const sharedSessionService = new DefaultSessionService(
    new SessionRepository(db),
    new UserRepository(db),
  );
  app.use('/api/v1/users', createDeletionRouter(db, sharedSessionService, emailDeliveryPort));

  // GET /api/v1/users/me — the calling user's own profile, reusing the same
  // session-validation guard as the deletion-request routes above.
  app.use('/api/v1/users', createUserProfileRouter(db, sharedSessionService));

  // /health is intentionally unauthenticated (API Gateway probing).
  app.use(createHealthRouter(db));

  // Swagger UI — serves DOCS/openapi.yaml, generated from the routes/controllers
  // themselves (see DOCS/PROJECT_ANALYSIS.md Phase 9). Unauthenticated, matching
  // the other introspection endpoint (/health).
  const openApiDocument = YAML.load(path.join(__dirname, '..', '..', 'DOCS', 'openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found.' });
  });

  app.use(createAppErrorHandler);

  return app;
}
