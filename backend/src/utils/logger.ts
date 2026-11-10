/**
 * Secure logger that automatically redacts sensitive data
 * Use this logger instead of console.log to prevent logging passwords, tokens, etc.
 */
export { secureLogger as logger, logRequest, logError, logWithMetadata } from './secureLogger';

