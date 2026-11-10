/**
 * Validation messages
 */
export const VALIDATION_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required`,
  INVALID_EMAIL: 'Invalid email format',
  INVALID_UUID: 'Invalid UUID format',
  MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters`,
  MAX_LENGTH: (field: string, max: number) => `${field} must not exceed ${max} characters`,
  MIN_VALUE: (field: string, min: number) => `${field} must be at least ${min}`,
  MAX_VALUE: (field: string, max: number) => `${field} must not exceed ${max}`,
  INVALID_ARRAY: (field: string) => `${field} must be an array`,
  ARRAY_MIN: (field: string, min: number) => `${field} must contain at least ${min} item(s)`,
  ARRAY_MAX: (field: string, max: number) => `${field} must not contain more than ${max} item(s)`,
  INVALID_DATE: 'Invalid date format',
  INVALID_BOOLEAN: 'Must be a boolean value',
  INVALID_NUMBER: 'Must be a number',
  STRING_EMPTY: (field: string) => `${field} cannot be empty`,
  DESCRIPTION_REQUIRED: 'Description is required',
  DESCRIPTION_EMPTY: 'Description cannot be empty',
} as const;

