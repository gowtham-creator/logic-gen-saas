import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables (skip for migrations, seeds, and utility scripts)
const isMigrationScript = process.argv.some((arg) => arg.includes('migration') || arg.includes('runMigrations'));
const isSeedScript = process.argv.some((arg) => arg.includes('seed') || process.argv[1]?.includes('seeds'));
  const isUtilityScript = process.argv.some((arg) => arg.includes('createTenant') || arg.includes('migrateClient') || arg.includes('backupAndRemove') || arg.includes('checkTenant') || arg.includes('verifyTenant') || arg.includes('fixTenantDatabaseFKs') || arg.includes('setSuperAdmin') || arg.includes('addIsSuperAdminToAllDatabases'));
const skipValidation = isMigrationScript || isSeedScript || isUtilityScript;
const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0 && !skipValidation) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables before starting the server.');
  process.exit(1);
}

// Validate JWT secret strength in production
if (process.env.NODE_ENV === 'production' && !skipValidation) {
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret && jwtSecret.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters long in production');
    process.exit(1);
  }
  if (jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
    console.error('❌ JWT_SECRET must be changed from default value in production');
    process.exit(1);
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/multitenant_saas',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET || (skipValidation ? 'temp-secret-for-scripts' : ''),
    refreshSecret: process.env.JWT_REFRESH_SECRET || (skipValidation ? 'temp-refresh-secret-for-scripts' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  oidc: {
    issuer: process.env.OIDC_ISSUER || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
    redirectUri: process.env.OIDC_REDIRECT_URI || 'http://localhost:3001/api/auth/oidc/callback',
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    // Allowed origins for CORS (comma-separated or JSON array)
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS 
      ? (process.env.CORS_ALLOWED_ORIGINS.startsWith('[') 
          ? JSON.parse(process.env.CORS_ALLOWED_ORIGINS)
          : process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()))
      : ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1', 'http://127.0.0.1:3000', 'http://frontend:3000'],
    // Development origin patterns (regex strings)
    developmentOriginPatterns: [
      '^https?://[^.]+\\.localhost(:\\d+)?$', // subdomain.localhost
      '^https?://[^.]+\\.multisaas\\.com(:\\d+)?$', // *.multisaas.com
    ],
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  // Server configuration
  server: {
    maxBodySize: process.env.MAX_BODY_SIZE || '10mb',
  },
  // Timeout configurations
  timeouts: {
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10), // 30 seconds
    responseTimeoutMs: parseInt(process.env.RESPONSE_TIMEOUT_MS || '30000', 10), // 30 seconds
    slackTimeoutMs: parseInt(process.env.SLACK_TIMEOUT_MS || '5000', 10), // 5 seconds
  },
  // Webhook configuration
  webhooks: {
    defaultMaxRetries: parseInt(process.env.WEBHOOK_DEFAULT_MAX_RETRIES || '3', 10),
    defaultTimeoutMs: parseInt(process.env.WEBHOOK_DEFAULT_TIMEOUT_MS || '5000', 10), // 5 seconds
    ackTimeoutMs: parseInt(process.env.WEBHOOK_ACK_TIMEOUT_MS || '30000', 10), // 30 seconds
  },
  // Retry and backoff configuration
  retry: {
    delayMultiplier: parseInt(process.env.RETRY_DELAY_MULTIPLIER || '50', 10),
    maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '2000', 10), // 2 seconds
  },
  // SSO configuration
  sso: {
    stateTtlSeconds: parseInt(process.env.SSO_STATE_TTL_SECONDS || '600', 10), // 10 minutes
    stateTtlMinutes: parseInt(process.env.SSO_STATE_TTL_MINUTES || '10', 10), // 10 minutes
  },
  // Secrets service configuration
  secrets: {
    cacheTtlMs: parseInt(process.env.SECRETS_CACHE_TTL_MS || '300000', 10), // 5 minutes
  },
  // Security monitoring configuration
  securityMonitoring: {
    eventBufferSize: parseInt(process.env.SECURITY_EVENT_BUFFER_SIZE || '100', 10),
    flushIntervalMs: parseInt(process.env.SECURITY_FLUSH_INTERVAL_MS || '60000', 10), // 1 minute
  },
  // Rate limiting configuration
  rateLimit: {
    global: {
      maxRequests: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS || '50000', 10),
    },
  },
  // Default client configuration for localhost development
  // Can be set via DEFAULT_CLIENT_ID (UUID) or DEFAULT_CLIENT_SUBDOMAIN (string)
  defaultClient: {
    id: process.env.DEFAULT_CLIENT_ID || undefined,
    subdomain: process.env.DEFAULT_CLIENT_SUBDOMAIN || undefined,
  },
};

