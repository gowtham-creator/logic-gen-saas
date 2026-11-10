/**
 * Validation constants
 */
export const VALIDATION = {
  // Field requirements
  REQUIRED: 'required',
  MIN_LENGTH: {
    PASSWORD: 8,
    DESCRIPTION: 1,
  },
  MAX_LENGTH: {
    NAME: 100,
    DESCRIPTION: 500,
  },
  
  // Patterns
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  
  // Messages
  MESSAGES: {
    REQUIRED: (field: string) => `${field} is required`,
    MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters`,
    MAX_LENGTH: (field: string, max: number) => `${field} must not exceed ${max} characters`,
    INVALID_EMAIL: 'Invalid email format',
    INVALID_UUID: 'Invalid ID format',
    DESCRIPTION_EMPTY: 'Description cannot be empty',
  },
} as const;

