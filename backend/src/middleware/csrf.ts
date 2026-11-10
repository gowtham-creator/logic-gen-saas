import { Request, Response, NextFunction } from 'express';
import csrf from 'csrf';
import { config } from '../config/config';
import { logger } from '../utils/logger';

const tokens = new csrf();

/**
 * CSRF protection middleware
 * Generates and validates CSRF tokens for state-changing operations
 * 
 * Note: CSRF protection is primarily needed for cookie-based authentication.
 * For JWT-based APIs, CSRF is less critical but still recommended for additional security.
 */
export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API key authentication (API keys are not vulnerable to CSRF)
  if (req.headers['x-api-key']) {
    return next();
  }

  // Skip CSRF for public authentication endpoints (login, refresh, etc.)
  // These are public endpoints and the first request will set the secret cookie
  const publicAuthenticationEndpoints = ['/auth/login', '/auth/refresh', '/auth/force-reset-password', '/auth/csrf-token'];
  if (publicAuthenticationEndpoints.includes(req.path)) {
    return next();
  }

  // Skip CSRF in development if configured
  if (config.nodeEnv === 'development' && process.env.SKIP_CSRF === 'true') {
    return next();
  }

  // Get secret from session or generate one
  // For stateless JWT auth, we use a per-request secret stored in a signed cookie
  const hadExistingSecret = !!req.cookies?.['csrf-secret'];
  const secret = req.cookies?.['csrf-secret'] || tokens.secretSync();
  
  // Set secret in cookie if not present
  if (!hadExistingSecret) {
    res.cookie('csrf-secret', secret, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    // Allow first request when setting new secret (client couldn't have known the secret yet)
    // On subsequent requests, they must provide a valid token
    return next();
  }

  // Get token from header or body
  // Note: Body parsing happens after CSRF middleware, so we primarily check headers
  const token = req.headers['x-csrf-token'] as string;

  // Verify token
  if (!token || !tokens.verify(secret, token)) {
    logger.warn('CSRF token validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      hadToken: !!token,
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or missing CSRF token',
      },
    });
    return;
  }

  next();
}

/**
 * Generate a CSRF token for the current request
 * This should be called after csrfMiddleware to ensure secret is set
 */
export function generateCsrfToken(req: Request): string {
  const secret = req.cookies?.['csrf-secret'] || tokens.secretSync();
  return tokens.create(secret);
}

