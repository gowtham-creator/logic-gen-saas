import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { endpointRateLimiter, RateLimitRequestHandler } from './rateLimiter';

// Create rate limiter instance once at module initialization (not during request handling)
// This ensures the limiter is created at app startup, not when responding to requests
const rateLimiterInstance: RateLimitRequestHandler = endpointRateLimiter();

/**
 * Rate limiter middleware that runs after authentication
 * This ensures userId is available for per-user rate limiting
 * Falls back to IP-based rate limiting if userId is not available
 * 
 * Note: The rate limiter instance is created once at module load time,
 * not during request handling, to comply with express-rate-limit requirements
 */
export function authenticatedRateLimiter() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Apply rate limiting - keyGenerator will use userId if available
    rateLimiterInstance(req, res, next);
  };
}

