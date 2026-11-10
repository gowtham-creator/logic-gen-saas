import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/config';
import { AppDataSource } from './config/database';
import { subdomainMiddleware } from './middleware/subdomain';
import { tenantDataSourceMiddleware } from './middleware/tenantDataSource';
import { endpointRateLimiter, globalRateLimiter } from './middleware/rateLimiter';
import { sanitizeMiddleware } from './middleware/sanitize';
import { csrfMiddleware } from './middleware/csrf';
import { logger } from './utils/logger';
import { swaggerSpec } from './config/swagger';
import authRouter from './routers/authRouter';
import roleRouter from './routers/roleRouter';
import roleTemplateRouter from './routers/roleTemplateRouter';
import apiKeyRouter from './routers/apiKeyRouter';
import permissionRouter from './routers/permissionRouter';
import userRouter from './routers/userRouter';
import clientRouter from './routers/clientRouter';
import planRouter from './routers/planRouter';
import auditLogRouter from './routers/auditLogRouter';
import themeRouter from './routers/themeRouter';
import webhookRouter from './routers/webhookRouter';
import webhookTestRouter from './routers/webhookTestRouter';
import customTableRouter from './routers/customTableRouter';
import superAdminRouter from './routers/superAdminRouter';
import developerRouter from './routers/developerRouter';
import storageRouter from './routers/storageRouter';
import workflowRouter from './routers/workflowRouter';
import dmnRouter from './routers/dmnRouter';
import mfaRouter from './routers/mfaRouter';
import deviceRouter from './routers/deviceRouter';
import { getSecurityMonitoringService, SecurityEventType } from './services/SecurityMonitoringService';
import { AUTH_CONSTANTS } from './constants/auth';

const app = express();

// Trust proxy to get real IP address (required for req.ip to work behind proxies)
app.set('trust proxy', true);

// Security middleware - Enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Next.js
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", config.appUrl, config.cors.origin],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));

// Set Permissions-Policy header separately (not supported in Helmet config)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(cookieParser());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      config.cors.origin,
      ...config.cors.allowedOrigins,
    ];
    
    // In development, allow localhost origins (including subdomains like testtenant.localhost)
    // Also allow custom domains like *.multisaas.com for testing
    if (config.nodeEnv === 'development') {
      // Allow exact localhost matches (with or without port)
      if (origin.startsWith('http://localhost') || 
          origin.startsWith('http://127.0.0.1') ||
          origin.startsWith('http://frontend')) {
        return callback(null, true);
      }
      // Allow subdomain patterns from config
      for (const pattern of config.cors.developmentOriginPatterns) {
        if (new RegExp(pattern).test(origin)) {
          return callback(null, true);
        }
      }
      // Allow theprojectava.com and its subdomains (both http and https)
      // Matches: http://theprojectava.com, https://theprojectava.com, http://www.theprojectava.com, etc.
      if (/^https?:\/\/([^.]+\.)?theprojectava\.com(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }
    
    // In production, only allow configured origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Also allow theprojectava.com and its subdomains in production (both http and https)
      // Matches: http://theprojectava.com, https://theprojectava.com, http://www.theprojectava.com, etc.
      if (/^https?:\/\/([^.]+\.)?theprojectava\.com(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Input sanitization middleware (protect against XSS)
app.use('/api/', sanitizeMiddleware);

// CSRF protection for state-changing operations
// Note: Applied after cookie parser but before body parsing
app.use('/api/', csrfMiddleware);

// Note: Global and endpoint rate limiting are applied later in the middleware chain

// Body parsing - express.json and urlencoded automatically skip multipart/form-data
// Request timeout enforcement - prevents slow connections from exhausting resources
// DMN pipeline can take 1–2+ min (upload + AI accept); use longer timeout for /api/dmn
const DMN_TIMEOUT_MS = parseInt(process.env.DMN_REQUEST_TIMEOUT_MS || '180000', 10) || 180000; // 3 min default
app.use((req, res, next) => {
  const isDmn = req.path.startsWith('/api/dmn');
  const requestMs = isDmn ? DMN_TIMEOUT_MS : config.timeouts.requestTimeoutMs;
  const responseMs = isDmn ? DMN_TIMEOUT_MS : config.timeouts.responseTimeoutMs;

  req.setTimeout(requestMs, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout. Please try again.',
        },
      });
    }
  });

  res.setTimeout(responseMs, () => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: {
          code: 'RESPONSE_TIMEOUT',
          message: 'Response timeout. Please try again.',
        },
      });
    }
  });

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: config.server.maxBodySize }));

// Serve static files (uploads)
app.use('/uploads/favicons', express.static('uploads/favicons'));
app.use('/uploads/logos', express.static('uploads/logos'));

// Request logging (secure - automatically redacts sensitive data)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    // Note: req.body, req.query, and headers are automatically redacted by secureLogger
  });
  next();
});

// Health check (no subdomain required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files for Swagger auth instructions
app.use('/public', express.static(path.join(__dirname, 'public')));

// Swagger UI Authentication Middleware
// Protect Swagger UI in production, allow in development
app.use('/api-docs', async (req, res, next) => {
  // Allow access in development
  if (config.nodeEnv === 'development') {
    return next();
  }

  // In production, require authentication
  // Check for token in Authorization header or query parameter
  let authHeader = req.headers.authorization;
  
  // If no Authorization header but token is in query parameter, set it
  if ((!authHeader || !authHeader.startsWith('Bearer ')) && req.query.token) {
    authHeader = `Bearer ${req.query.token}`;
    req.headers.authorization = authHeader;
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For Swagger UI HTML page, redirect to login message
    if (req.path === '' || req.path === '/') {
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Swagger UI - Authentication Required</title></head>
          <body>
            <h1>Authentication Required</h1>
            <p>Swagger UI is protected. Please authenticate using a valid JWT token.</p>
            <p>You can authenticate by:</p>
            <ol>
              <li>Logging in via the API: POST /api/auth/login</li>
              <li>Using the token in the Authorization header: Bearer &lt;token&gt;</li>
              <li>Or accessing Swagger UI in development mode</li>
            </ol>
          </body>
        </html>
      `);
    }
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required to access Swagger UI' },
    });
  }

  // Verify token
  try {
    const jwt = require('jsonwebtoken');
    const token = authHeader.substring(AUTH_CONSTANTS.BEARER_PREFIX_LENGTH);
    jwt.verify(token, config.jwt.secret);
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
});

// Swagger API Documentation
// Allow access to Swagger UI page, but users must authenticate via "Authorize" button
// The JSON endpoint is public (needed for Swagger UI to load the spec)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 24px; }
    .swagger-ui .scheme-container { 
      background: #f9fafb; 
      padding: 15px; 
      border-radius: 4px; 
      margin: 20px 0;
      border: 1px solid #e5e7eb;
    }
    .swagger-ui .btn.authorize {
      background-color: #10b981;
      border-color: #10b981;
    }
    .swagger-ui .btn.authorize:hover {
      background-color: #059669;
    }
  `,
  customSiteTitle: 'Multi-Tenant SaaS API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true, // Remember auth token in browser
    displayRequestDuration: true,
    filter: true, // Enable search/filter
    tryItOutEnabled: true, // Enable "Try it out" by default
    // Show instructions in the description
    docExpansion: 'list', // Expand operations by default
  },
  customCssUrl: undefined,
}));

// Swagger JSON endpoint - Public (needed for Swagger UI to load)
app.get('/api-docs.json', (req, res) => {
  try {
    // Dynamically set server URL based on request
    // Handle proxy headers (X-Forwarded-Proto, X-Forwarded-Host)
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost';
    const baseUrl = `${protocol}://${host}`;
    
    // Clone the spec and update servers dynamically
    const dynamicSpec = JSON.parse(JSON.stringify(swaggerSpec));
    dynamicSpec.servers = [
      {
        url: baseUrl,
        description: 'Current server',
      },
      {
        url: 'http://localhost',
        description: 'Local development',
      },
    ];
    
    // Remove superadmin paths from dynamic spec (already filtered in swagger.ts, but ensure it's clean)
    if (dynamicSpec.paths) {
      const pathsToRemove: string[] = [];
      for (const path in dynamicSpec.paths) {
        if (path.startsWith('/api/super-admin')) {
          pathsToRemove.push(path);
        }
      }
      pathsToRemove.forEach(path => {
        delete dynamicSpec.paths[path];
      });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.send(dynamicSpec);
  } catch (error: any) {
    logger.error('Error serving Swagger JSON', { error: error?.message || error });
    res.status(500).json({ error: 'Failed to generate Swagger spec' });
  }
});

logger.info(`Swagger documentation available at /api-docs (${Object.keys(swaggerSpec.paths || {}).length} endpoints documented)`);

// Super admin routes (no subdomain required)
// Note: Super admin login is now handled by /api/auth/login based on isSuperAdmin flag
app.use('/api/super-admin', superAdminRouter);

// Developer routes (no subdomain required)
// Note: Developer login is now handled by /api/auth/login based on isDeveloper flag
app.use('/api/developer', developerRouter);

// Subdomain middleware for all API routes (except super admin routes, developer routes, and test endpoints)
app.use('/api', (req, res, next) => {
  // Skip subdomain check for super admin routes, developer routes, and test endpoints
  if (req.path.startsWith('/super-admin') ||
      req.path.startsWith('/developer') ||
      req.path.startsWith('/clients') || 
      req.path.startsWith('/plans') || 
      req.path.startsWith('/storage') ||
      req.path.startsWith('/webhook-test')) {
    return next();
  }
  subdomainMiddleware(req as any, res, next);
});

// Tenant DataSource middleware - attaches tenant-specific DataSource based on plan
app.use('/api', (req, res, next) => {
  // Skip for super admin routes, developer routes, and test endpoints (they use shared DataSource)
  if (req.path.startsWith('/super-admin') ||
      req.path.startsWith('/developer') ||
      req.path.startsWith('/clients') || 
      req.path.startsWith('/plans') || 
      req.path.startsWith('/storage') ||
      req.path.startsWith('/webhook-test')) {
    return next();
  }
  tenantDataSourceMiddleware(req as any, res, next).catch(next);
});

// Global rate limiting - safety net across all IPs
// This complements Cloudflare's protection by adding application-level defense-in-depth
// Applied before endpoint-specific rate limiting
app.use('/api', globalRateLimiter());

// Create endpoint rate limiter instance at app initialization (not during request handling)
// This must be created once, not on every request
const endpointRateLimiterInstance = endpointRateLimiter();

// Apply rate limiting for unauthenticated routes (IP-based)
// This runs before routes, so userId is not available - uses IP address
// Only applies to auth endpoints that don't require authentication
// Authenticated routes will have rate limiting applied after authMiddleware in their routers
app.use('/api', (req, res, next) => {
  // Only apply to auth endpoints (login, refresh, etc.) - these don't have userId yet
  if (req.path.startsWith('/auth/login') || 
      req.path.startsWith('/auth/refresh') ||
      req.path.startsWith('/auth/reset-password') ||
      req.path.startsWith('/auth/csrf-token')) {
    endpointRateLimiterInstance(req, res, next);
  } else {
    next(); // Skip rate limiting for other routes here (will be applied after auth in routers)
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/roles', roleRouter);
app.use('/api/role-templates', roleTemplateRouter);
app.use('/api/api-keys', apiKeyRouter);
app.use('/api/permissions', permissionRouter);
app.use('/api/users', userRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/theme', themeRouter);
app.use('/api/webhooks', webhookRouter);
// Webhook test listener (no auth required for testing)
app.use('/api/webhook-test', webhookTestRouter);
app.use('/api/custom-tables', customTableRouter);
app.use('/api/workflows', workflowRouter);
// Log before DMN so we can see if request reaches router (after tenant + global rate limiter)
app.use('/api/dmn', (req, res, next) => {
  logger.info('[DMN] request reached /api/dmn (before router)', { method: req.method, path: req.path });
  next();
});
app.use('/api/dmn', dmnRouter);
app.use('/api/devices', deviceRouter);

// Super admin routes (no subdomain required, but auth required)
app.use('/api/clients', clientRouter);
app.use('/api/plans', planRouter);
app.use('/api/storage', storageRouter);
app.use('/api/mfa', mfaRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log full error details (including stack) for debugging
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Log security-relevant errors for monitoring
  const securityErrorCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'TOKEN_REVOKED', 'INVALID_TOKEN', 'CSRF_TOKEN_INVALID'];
  if (err.code && securityErrorCodes.includes(err.code)) {
    try {
      const securityMonitoring = getSecurityMonitoringService();
      const eventType = err.code === 'UNAUTHORIZED' ? SecurityEventType.UNAUTHORIZED_ACCESS :
                        err.code === 'FORBIDDEN' ? SecurityEventType.FORBIDDEN_ACCESS :
                        err.code === 'TOKEN_REVOKED' ? SecurityEventType.TOKEN_BLACKLISTED :
                        SecurityEventType.UNAUTHORIZED_ACCESS;
    
      securityMonitoring.log({
        type: eventType,
        severity: 'medium',
        message: `Security error: ${err.code}`,
        metadata: {
          errorCode: err.code,
          clientId: (req as any).clientId,
          subdomain: (req as any).tenant?.subdomain || undefined,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });
    } catch (monitoringError) {
      // Don't fail error handling if monitoring fails
      logger.error('Failed to log security event', { error: monitoringError });
    }
  }

  // In production, don't expose error details
  const isProduction = config.nodeEnv === 'production';
  const statusCode = err.status || 500;
  
  // Determine error message
  let errorMessage = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';

  if (err.code) {
    errorCode = err.code;
  }

  // Only expose specific error messages in development or for known safe errors
  if (!isProduction || (err.code && ['VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].includes(err.code))) {
    errorMessage = err.message || errorMessage;
  } else if (statusCode === 500) {
    // Generic error for production 500s
    errorMessage = 'An internal error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Initialize database and start server
async function start() {
  try {
    await AppDataSource.initialize();
    logger.info('Database connected');

    // Initialize Encryption Service (required for production with AWS Secrets Manager)
    try {
      const { initializeEncryptionService } = await import('./utils/encryption');
      await initializeEncryptionService();
      logger.info('Encryption service initialized');
    } catch (error: any) {
      logger.warn('Encryption service initialization failed', { error: error.message });
      // In development, this might be expected if using env vars
      if (config.nodeEnv === 'production') {
        logger.error('Encryption service initialization is required in production');
        throw error;
      }
    }

    // Initialize TenantDataSourceManager
    const { getTenantDataSourceManager } = await import('./services/TenantDataSourceManager');
    getTenantDataSourceManager(); // Initialize singleton
    logger.info('Tenant DataSource Manager initialized');

    // Initialize webhook queue service (only if Redis is available)
    try {
      const { getWebhookQueueService } = await import('./services/WebhookQueueService');
      getWebhookQueueService(); // Initialize queue service
      logger.info('Webhook queue service initialized');
    } catch (error: any) {
      logger.warn('Webhook queue service not available (Redis may not be running)', { error: error.message });
      logger.info('Webhooks will use fallback delivery system');
    }

    // Graceful shutdown - close tenant DataSource connections
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing connections...');
      const tenantDataSourceManager = getTenantDataSourceManager();
      await tenantDataSourceManager.closeAll();
      await AppDataSource.destroy();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, closing connections...');
      const tenantDataSourceManager = getTenantDataSourceManager();
      await tenantDataSourceManager.closeAll();
      await AppDataSource.destroy();
      process.exit(0);
    });

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

