import winston from 'winston';
import { config } from '../config/config';

/**
 * List of sensitive field names that should be redacted from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'keyHash',
  'secret',
  'clientSecret',
  'encryptionKey',
  'jwtSecret',
  'jwt_secret',
  'authorization',
  'authorizationHeader',
  'x-api-key',
  'x-api-key-header',
  'cookie',
  'cookies',
  'csrf-token',
  'csrfToken',
  'totpSecret',
  'backupCodes',
  'encryptedSecret',
  'encryptedCodes',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'creditCardNumber',
  'cvv',
  'cvc',
  'pin',
  'otp',
  'mfaCode',
  'verificationCode',
];

/**
 * Redact sensitive data from an object recursively
 */
function redactSensitiveData(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle strings - check if they look like sensitive data
  if (typeof obj === 'string') {
    // Redact if it looks like a JWT token
    if (obj.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
      return '[JWT_TOKEN_REDACTED]';
    }
    // Redact if it looks like an API key (long alphanumeric string)
    if (obj.length > 20 && obj.match(/^[A-Za-z0-9]+$/)) {
      return '[API_KEY_REDACTED]';
    }
    // Redact if it looks like a hash
    if (obj.match(/^[a-f0-9]{32,}$/i)) {
      return '[HASH_REDACTED]';
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        
        // Check if this field should be redacted
        const shouldRedact = SENSITIVE_FIELDS.some(field => 
          lowerKey.includes(field.toLowerCase())
        );

        if (shouldRedact) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = redactSensitiveData(obj[key], depth + 1);
        }
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Redact sensitive data from request objects
 */
function redactRequest(req: any): any {
  if (!req) return req;

  const redacted: any = {
    method: req.method,
    path: req.path,
    // Don't log full URL as it might contain sensitive query params
    url: req.path, // Only path, not full URL with query
  };

  // Redact headers
  if (req.headers) {
    redacted.headers = redactSensitiveData(req.headers);
  }

  // Redact query parameters (some might be sensitive)
  if (req.query) {
    redacted.query = redactSensitiveData(req.query);
  }

  // Redact body (likely contains passwords, tokens, etc.)
  if (req.body) {
    redacted.body = redactSensitiveData(req.body);
  }

  // Safe to log these
  if (req.ip) redacted.ip = req.ip;
  if (req.userId) redacted.userId = req.userId;
  if (req.clientId) redacted.clientId = req.clientId;

  return redacted;
}

/**
 * Custom format for Winston that redacts sensitive data
 */
const redactFormat = winston.format((info) => {
  // Redact sensitive data from metadata
  if (info.metadata) {
    info.metadata = redactSensitiveData(info.metadata);
  }

  // Redact sensitive data from message if it's an object
  if (typeof info.message === 'object') {
    info.message = redactSensitiveData(info.message);
  }

  // Redact request objects
  if (info.req) {
    info.req = redactRequest(info.req);
  }

  // Redact error objects (might contain sensitive data in stack traces)
  if (info.error) {
    const error = info.error as Error;
    const errorInfo: any = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      // Don't include stack trace in production
      ...(config.nodeEnv === 'development' && error.stack ? { stack: error.stack } : {}),
    };
    info.error = errorInfo;
  }

  return info;
});

/**
 * Secure logger that automatically redacts sensitive data
 */
export const secureLogger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    redactFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: config.nodeEnv === 'development' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'multi-tenant-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Helper function to safely log requests
 */
export function logRequest(level: string, message: string, req?: any, metadata?: any): void {
  const logData: any = {
    message,
    ...(req && { req: redactRequest(req) }),
    ...(metadata && { metadata: redactSensitiveData(metadata) }),
  };

  secureLogger.log(level, logData);
}

/**
 * Helper function to safely log errors
 */
export function logError(message: string, error?: any, metadata?: any): void {
  const logData: any = {
    message,
    ...(error && { error }),
    ...(metadata && { metadata: redactSensitiveData(metadata) }),
  };

  secureLogger.error(logData);
}

/**
 * Helper function to safely log with metadata
 */
export function logWithMetadata(level: string, message: string, metadata?: any): void {
  secureLogger.log(level, message, {
    metadata: redactSensitiveData(metadata || {}),
  });
}

