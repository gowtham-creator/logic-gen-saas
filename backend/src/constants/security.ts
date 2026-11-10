/**
 * Security-related constants
 */
export const SECURITY_CONSTANTS = {
  // Account lockout
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCKOUT_MINUTES: 15,
  MAX_FAILED_ATTEMPTS_PER_IP: 5,
  FAILED_ATTEMPT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes

  // Encryption
  BCRYPT_ROUNDS: 10,

  // Device tracking
  MAX_RECENT_DEVICES: 5,
  SIMULTANEOUS_LOGIN_WINDOW_MS: 5 * 60 * 1000, // 5 minutes

  // Security monitoring
  EVENT_BUFFER_SIZE: 100,
  FLUSH_INTERVAL_MS: 60000, // 1 minute

  // String truncation limits
  MAX_HTML_PREVIEW_LENGTH: 200,
  MAX_URL_LOG_LENGTH: 200,
  MAX_SLACK_VALUE_LENGTH: 100,
} as const;

