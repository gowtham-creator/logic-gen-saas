import rateLimit, { RateLimitRequestHandler, Options, Store, ipKeyGenerator } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, EndpointRateLimitConfig } from '../types/middleware.types';
import { getRedisRateLimitStore } from '../utils/redisRateLimitStore';
import { logger } from '../utils/logger';
import { getSecurityMonitoringService, SecurityEventType } from '../services/SecurityMonitoringService';
import { config } from '../config/config';

// Re-export for backward compatibility
export { EndpointRateLimitConfig };
export type { RateLimitRequestHandler };

/**
 * Rate limit configurations for different API endpoints
 */
export const ENDPOINT_RATE_LIMITS: Record<string, EndpointRateLimitConfig> = {
  // Auth endpoints - more restrictive
  '/api/auth/login': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many login attempts, please try again later.',
  },
  '/api/auth/refresh': {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 refresh attempts per minute
    message: 'Too many token refresh attempts, please try again later.',
  },
  '/api/auth': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 auth requests per 15 minutes
  },

  // User management - moderate limits
  '/api/users': {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  },
  '/api/users/create': {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 user creations per minute
  },
  '/api/users/update': {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 user updates per minute
  },
  '/api/users/delete': {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 user deletions per minute
  },

  // Role management
  '/api/roles': {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  },
  '/api/role-templates': {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  },

  // Permissions
  '/api/permissions': {
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 requests per minute (read-heavy)
  },

  // API Keys - more restrictive
  '/api/api-keys': {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
  },
  '/api/api-keys/create': {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 API key creations per minute
  },

  // Audit logs - moderate limits
  '/api/audit-logs': {
    windowMs: 60 * 1000, // 1 minute
    max: 40, // 40 requests per minute
  },

  // Theme management
  '/api/theme': {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
  },
  '/api/theme/upload': {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute
  },

  // Client management (super admin) - more restrictive
  '/api/clients': {
    windowMs: 60 * 1000, // 1 minute
    max: 15, // 15 requests per minute
  },
  '/api/clients/create': {
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 client creations per minute
  },

  // Plans (super admin)
  '/api/plans': {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
  },
};

/**
 * Default rate limit for endpoints not specifically configured
 */
export const DEFAULT_RATE_LIMIT: EndpointRateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute (increased from 30)
  message: 'Too many requests, please try again later.',
};

/**
 * Create Redis store for rate limiting
 * Returns undefined if Redis is not available (falls back to in-memory)
 */
function createRedisStore(): Store | undefined {
  const redisStore = getRedisRateLimitStore();
  
  if (!redisStore.isAvailable()) {
    return undefined; // Use default in-memory store
  }

  logger.info('Using Redis store for rate limiting (distributed rate limiting enabled)');
  return redisStore as Store;
}

/**
 * Global rate limiter - applies across all IPs as a safety net
 * This complements Cloudflare's protection by adding application-level defense-in-depth
 * 
 * Configuration:
 * - Adjust max based on your server capacity and expected legitimate traffic
 * - Should be higher than Cloudflare's limits to act as safety net, not primary protection
 */
export function globalRateLimiter(): RateLimitRequestHandler {
  const redisStore = createRedisStore();
  
  if (!redisStore) {
    logger.info('Global rate limiter using in-memory store (single instance only)');
  }

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: config.rateLimit.global.maxRequests, // Total requests per minute across all IPs
    message: 'Server is experiencing high traffic. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore, // Use Redis if available for distributed limiting
    keyGenerator: () => 'global', // Same key for all requests
    handler: (req: Request, res: Response) => {
      logger.warn('[RateLimit] global rate limit exceeded', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        clientId: (req as AuthenticatedRequest).clientId,
      });
      // Log security event for monitoring
      const securityMonitoring = getSecurityMonitoringService();
      const authReq = req as AuthenticatedRequest;
      securityMonitoring.log({
        type: SecurityEventType.GLOBAL_RATE_LIMIT_HIT,
        severity: 'high',
        message: 'Global rate limit exceeded - potential DDoS or traffic spike',
        metadata: {
          clientId: authReq.clientId,
          subdomain: (authReq as any).tenant?.subdomain || undefined,
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Server is experiencing high traffic. Please try again later.',
        },
      });
    },
    // Skip successful requests to only count actual load
    skipSuccessfulRequests: false,
    // Don't skip failed requests - they still consume resources
    skipFailedRequests: false,
  });
}

/**
 * Get rate limit configuration for a specific path
 */
export function getRateLimitConfig(path: string): EndpointRateLimitConfig {
  // Try exact match first
  if (ENDPOINT_RATE_LIMITS[path]) {
    return ENDPOINT_RATE_LIMITS[path];
  }

  // Try to match by prefix (e.g., /api/users/123 matches /api/users)
  const pathParts = path.split('/').filter(Boolean);
  for (let i = pathParts.length; i > 0; i--) {
    const testPath = '/' + pathParts.slice(0, i).join('/');
    if (ENDPOINT_RATE_LIMITS[testPath]) {
      return ENDPOINT_RATE_LIMITS[testPath];
    }
  }

  // Check for base path match (e.g., /api/users matches /api/users)
  const basePath = path.split('?')[0]; // Remove query string
  if (ENDPOINT_RATE_LIMITS[basePath]) {
    return ENDPOINT_RATE_LIMITS[basePath];
  }

  return DEFAULT_RATE_LIMIT;
}

/**
 * Create a rate limiter for a specific endpoint
 */
export function createEndpointRateLimiter(path: string): RateLimitRequestHandler {
  const config = getRateLimitConfig(path);

  const options: Partial<Options> = {
    windowMs: config.windowMs,
    max: config.max,
    message: config.message || DEFAULT_RATE_LIMIT.message,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    // Use IP address as key, but can be customized
    keyGenerator: (req: Request) => {
      // For authenticated requests, use user ID + IP for better tracking
      const authReq = req as AuthenticatedRequest;
      // Use ipKeyGenerator helper for proper IPv6 handling (type assertion needed due to incorrect TS types)
      const ip = (ipKeyGenerator as any)(req);
      if (authReq.userId) {
        return `${authReq.userId}:${ip}`;
      }
      return ip;
    },
    // Custom handler
    handler: (req: Request, res: Response) => {
      const config = getRateLimitConfig(req.path);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message || 'Too many requests, please try again later.',
        },
      });
    },
  };

  return rateLimit(options);
}

/**
 * Middleware factory to apply rate limiting based on request path
 * This creates a rate limiter that uses different limits based on the endpoint
 * All rate limiters are created at initialization time, not during request handling
 */
export function endpointRateLimiter(): RateLimitRequestHandler {
  // Store rate limiters per endpoint pattern - created at initialization
  const limiters = new Map<string, RateLimitRequestHandler>();

  // Pre-create limiters for all known endpoint patterns
  const endpointPatterns = new Set<string>();
  
  // Extract all unique endpoint patterns from ENDPOINT_RATE_LIMITS
  Object.keys(ENDPOINT_RATE_LIMITS).forEach(path => {
    const parts = path.split('/').filter(Boolean);
    // Create patterns like /api, /api/auth, /api/users, etc.
    for (let i = 1; i <= Math.min(parts.length, 3); i++) {
      const pattern = '/' + parts.slice(0, i).join('/');
      endpointPatterns.add(pattern);
    }
  });

  // Create Redis store (shared across all limiters)
  const redisStore = createRedisStore();
  if (!redisStore) {
    logger.info('Using in-memory store for rate limiting (single instance only)');
  }

  // Create a default limiter for unknown endpoints
  const defaultLimiter = rateLimit({
    windowMs: DEFAULT_RATE_LIMIT.windowMs,
    max: DEFAULT_RATE_LIMIT.max,
    message: DEFAULT_RATE_LIMIT.message,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore, // Use Redis if available
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      // Use userId if available (for authenticated routes), otherwise use IP
      // Use ipKeyGenerator helper for proper IPv6 handling (type assertion needed due to incorrect TS types)
      const ip = (ipKeyGenerator as any)(req);
      if (authReq.userId) {
        // For authenticated users, combine userId with IP
        return `${authReq.userId}:${ip}:default`;
      }
      // For unauthenticated, use IP with proper IPv6 handling
      return `${ip}:default`;
    },
    handler: (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      
      // Log security event for monitoring
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: authReq.userId ? 'medium' : 'high', // Higher severity for unauthenticated
        message: 'Rate limit exceeded (default limiter)',
          metadata: {
            userId: authReq.userId,
            clientId: authReq.clientId,
            subdomain: (authReq as any).tenant?.subdomain || undefined,
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get('user-agent'),
          },
          timestamp: new Date(),
        });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: DEFAULT_RATE_LIMIT.message,
        },
      });
    },
  });

  // Pre-create limiters for all known endpoint patterns
  endpointPatterns.forEach(endpointKey => {
    const config = getRateLimitConfig(endpointKey);
    
    const limiter = rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      message: config.message || DEFAULT_RATE_LIMIT.message,
      standardHeaders: true,
      legacyHeaders: false,
      store: redisStore, // Use Redis if available
      keyGenerator: (req: Request) => {
        const authReq = req as AuthenticatedRequest;
        // Use userId if available (for authenticated routes), otherwise use IP
        if (authReq.userId) {
          // For authenticated users, combine userId with IP using proper IPv6 handling
          const ip = ipKeyGenerator(req as any);
          return `${authReq.userId}:${ip}:${endpointKey}`;
        }
        // For unauthenticated, use IP with proper IPv6 handling
        return `${ipKeyGenerator(req as any)}:${endpointKey}`;
      },
      handler: (req: Request, res: Response) => {
        const pathConfig = getRateLimitConfig(req.path);
        const authReq = req as AuthenticatedRequest;
        
        // Log security event for monitoring
        const securityMonitoring = getSecurityMonitoringService();
        securityMonitoring.log({
          type: SecurityEventType.RATE_LIMIT_EXCEEDED,
          severity: authReq.userId ? 'medium' : 'high', // Higher severity for unauthenticated
          message: 'Rate limit exceeded',
          metadata: {
            userId: authReq.userId,
            clientId: authReq.clientId,
            subdomain: (authReq as any).tenant?.subdomain || undefined,
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get('user-agent'),
            endpoint: endpointKey,
          },
          timestamp: new Date(),
        });
        
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: pathConfig.message || DEFAULT_RATE_LIMIT.message,
          },
        });
      },
    });
    
    limiters.set(endpointKey, limiter);
  });

  // The middleware function that selects the appropriate limiter
  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path.split('?')[0]; // Remove query string
    
    // Try to find a matching endpoint pattern
    // Check from most specific to least specific
    const pathParts = path.split('/').filter(Boolean);
    let matchedLimiter: RateLimitRequestHandler | undefined;
    
    // Try matching from most specific (3 parts) to least specific (1 part)
    for (let i = Math.min(pathParts.length, 3); i >= 1; i--) {
      const endpointKey = '/' + pathParts.slice(0, i).join('/');
      if (limiters.has(endpointKey)) {
        matchedLimiter = limiters.get(endpointKey);
        break;
      }
    }
    
    // Use matched limiter or default
    const limiter = matchedLimiter || defaultLimiter;
    limiter(req, res, next);
  };

  return middleware as RateLimitRequestHandler;
}

/**
 * Apply rate limiting to specific routes
 * This is a simpler approach that applies rate limiters to specific route patterns
 */
export function applyRateLimitToRoute(
  path: string,
  config?: Partial<EndpointRateLimitConfig>
): RateLimitRequestHandler {
  const endpointConfig = getRateLimitConfig(path);
  const finalConfig = { ...endpointConfig, ...config };

  return rateLimit({
    windowMs: finalConfig.windowMs,
    max: finalConfig.max,
    message: finalConfig.message || DEFAULT_RATE_LIMIT.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      const ip = ipKeyGenerator(req as any);
      if (authReq.userId) {
        return `${authReq.userId}:${ip}`;
      }
      return ip;
    },
  });
}

