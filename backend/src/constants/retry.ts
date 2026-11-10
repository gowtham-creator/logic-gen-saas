/**
 * Retry and backoff constants
 */
export const RETRY_CONSTANTS = {
  DELAY_MULTIPLIER: 50, // Base delay multiplier (times * 50)
  MAX_DELAY_MS: 2000, // Maximum delay between retries (2 seconds)
} as const;

