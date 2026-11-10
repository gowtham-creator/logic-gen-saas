/**
 * Multi-Factor Authentication (MFA) constants
 */
export const MFA_CONSTANTS = {
  BACKUP_CODES_COUNT: 10,
  BACKUP_CODE_LENGTH: 8, // substring(2, 10) = 8 characters
  TOTP_WINDOW: 2, // Allow tokens from previous/next 2 time steps (60 seconds each)
} as const;

