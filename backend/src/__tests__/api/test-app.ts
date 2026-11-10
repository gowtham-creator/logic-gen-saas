// Export app for testing without starting the server
import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from '../../config/config';
import { subdomainMiddleware } from '../../middleware/subdomain';
import { tenantDataSourceMiddleware } from '../../middleware/tenantDataSource';
import { endpointRateLimiter } from '../../middleware/rateLimiter';
import { sanitizeMiddleware } from '../../middleware/sanitize';
import { swaggerSpec } from '../../config/swagger';
import authRouter from '../../routers/authRouter';
import roleRouter from '../../routers/roleRouter';
import roleTemplateRouter from '../../routers/roleTemplateRouter';
import apiKeyRouter from '../../routers/apiKeyRouter';
import permissionRouter from '../../routers/permissionRouter';
import userRouter from '../../routers/userRouter';
import clientRouter from '../../routers/clientRouter';
import planRouter from '../../routers/planRouter';
import auditLogRouter from '../../routers/auditLogRouter';
import themeRouter from '../../routers/themeRouter';
import webhookRouter from '../../routers/webhookRouter';
import webhookTestRouter from '../../routers/webhookTestRouter';
import customTableRouter from '../../routers/customTableRouter';
import superAdminRouter from '../../routers/superAdminRouter';
import developerRouter from '../../routers/developerRouter';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      config.cors.origin,
      'http://localhost',
      'http://localhost:3000',
      'http://127.0.0.1',
      'http://127.0.0.1:3000',
      'http://frontend:3000',
    ];
    if (config.nodeEnv === 'development') {
      if (origin.startsWith('http://localhost') || 
          origin.startsWith('http://127.0.0.1') ||
          origin.startsWith('http://frontend')) {
        return callback(null, true);
      }
      if (/^https?:\/\/[^.]+\.localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Input sanitization middleware
app.use('/api/', sanitizeMiddleware);

// Rate limiting
app.use('/api/', endpointRateLimiter());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads/favicons', express.static('uploads/favicons'));
app.use('/uploads/logos', express.static('uploads/logos'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve public files
app.use('/public', express.static(path.join(__dirname, '../../public')));

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Routes that don't require subdomain/tenant middleware
app.use('/api/super-admin', superAdminRouter);
app.use('/api/developer', developerRouter);

// Apply subdomain middleware for other routes
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/super-admin') ||
      req.path.startsWith('/developer') ||
      req.path.startsWith('/clients') ||
      req.path.startsWith('/plans') ||
      req.path.startsWith('/webhook-test')) {
    return next();
  }
  subdomainMiddleware(req as any, res, next);
});

// Apply tenant data source middleware
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/super-admin') ||
      req.path.startsWith('/developer') ||
      req.path.startsWith('/clients') ||
      req.path.startsWith('/plans') ||
      req.path.startsWith('/webhook-test')) {
    return next();
  }
  tenantDataSourceMiddleware(req as any, res, next).catch(next);
});

// Regular API routes
app.use('/api/auth', authRouter);
app.use('/api/roles', roleRouter);
app.use('/api/role-templates', roleTemplateRouter);
app.use('/api/api-keys', apiKeyRouter);
app.use('/api/permissions', permissionRouter);
app.use('/api/users', userRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/theme', themeRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/webhook-test', webhookTestRouter);
app.use('/api/custom-tables', customTableRouter);

// Super admin routes
app.use('/api/clients', clientRouter);
app.use('/api/plans', planRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response) => {
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
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

export default app;
