import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '../utils/sanitize';

/**
 * Middleware to sanitize user input to prevent XSS attacks
 * Sanitizes request body, query parameters, and URL parameters
 */
export function sanitizeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Sanitize request body (skip for file uploads)
  if (req.body && typeof req.body === 'object' && !req.headers['content-type']?.includes('multipart/form-data')) {
    req.body = sanitizeInput(req.body);
  }

  // Sanitize query parameters (modify values in place to avoid read-only property error)
  if (req.query && typeof req.query === 'object') {
    const query = req.query as Record<string, any>;
    for (const key in query) {
      if (Object.prototype.hasOwnProperty.call(query, key)) {
        const value = query[key];
        if (typeof value === 'string') {
          query[key] = sanitizeInput(value);
        } else if (Array.isArray(value)) {
          query[key] = value.map(item => 
            typeof item === 'string' ? sanitizeInput(item) : item
          );
        }
      }
    }
  }

  // Sanitize URL parameters (modify values in place to avoid read-only property error)
  if (req.params && typeof req.params === 'object') {
    const params = req.params as Record<string, any>;
    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        const value = params[key];
        if (typeof value === 'string') {
          params[key] = sanitizeInput(value);
        }
      }
    }
  }

  next();
}

