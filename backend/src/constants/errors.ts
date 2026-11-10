/**
 * Error code constants
 */
export const ERROR_CODES = {
  // Authentication errors
  LOGIN_ERROR: 'LOGIN_ERROR',
  REFRESH_ERROR: 'REFRESH_ERROR',
  LOGOUT_ERROR: 'LOGOUT_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  IN_USE: 'IN_USE',
  
  // Permission errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  
  // OIDC errors
  OIDC_ERROR: 'OIDC_ERROR',
  OIDC_CALLBACK_ERROR: 'OIDC_CALLBACK_ERROR',
  
  // API errors
  LIST_PERMISSIONS_ERROR: 'LIST_PERMISSIONS_ERROR',
  GET_PERMISSION_ERROR: 'GET_PERMISSION_ERROR',
  UPDATE_PERMISSION_ERROR: 'UPDATE_PERMISSION_ERROR',
  GET_PERMISSIONS_ERROR: 'GET_PERMISSIONS_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  RESPONSE_TIMEOUT: 'RESPONSE_TIMEOUT',
  
  // Role errors
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  ROLE_ALREADY_EXISTS: 'ROLE_ALREADY_EXISTS',
  ROLE_IN_USE: 'ROLE_IN_USE',
  
  // Permission errors
  PERMISSION_NOT_FOUND: 'PERMISSION_NOT_FOUND',
  
  // Template errors
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_ALREADY_EXISTS: 'TEMPLATE_ALREADY_EXISTS',
  TEMPLATE_IN_USE: 'TEMPLATE_IN_USE',
  TEMPLATE_CREATE_ERROR: 'TEMPLATE_CREATE_ERROR',
  TEMPLATE_UPDATE_ERROR: 'TEMPLATE_UPDATE_ERROR',
  TEMPLATE_DELETE_ERROR: 'TEMPLATE_DELETE_ERROR',
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  // Authentication
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Insufficient permissions',
  TENANT_MISMATCH: 'Tenant mismatch',
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Token has expired',
  REFRESH_TOKEN_REQUIRED: 'Refresh token is required',
  
  // Validation
  VALIDATION_FAILED: 'Validation failed',
  REQUIRED_FIELD: (field: string) => `${field} is required`,
  INVALID_FORMAT: (field: string) => `Invalid ${field} format`,
  
  // Resources
  NOT_FOUND: (resource: string) => `${resource} not found`,
  ALREADY_EXISTS: (resource: string) => `${resource} already exists`,
  IN_USE: (resource: string) => `Cannot delete ${resource} that is in use`,
  
  // Roles
  ROLE_NOT_FOUND: 'Role not found',
  ROLE_ALREADY_EXISTS: 'Role with this name already exists',
  ROLE_IN_USE: 'Cannot delete role that is assigned to users',
  ROLE_UPDATE_FAILED: 'Role not found after update',
  ROLE_CREATE_FAILED: 'Failed to create role',
  
  // Templates
  TEMPLATE_NOT_FOUND: 'Role template not found',
  TEMPLATE_ALREADY_EXISTS: 'Role template with this name already exists',
  TEMPLATE_IN_USE: (count: number) => `Cannot delete template that is used by ${count} role(s). Remove template from roles first.`,
  TEMPLATE_CREATE_FAILED: 'Failed to create template',
  TEMPLATE_UPDATE_FAILED: 'Template not found after update',
  
  // Permissions
  PERMISSION_NOT_FOUND: 'Permission not found',
  
  // Generic
  INTERNAL_ERROR: 'Internal server error',
  NOT_IMPLEMENTED: 'Feature not fully implemented',
  
  // Timeout errors
  REQUEST_TIMEOUT: 'Request timeout. Please try again.',
  RESPONSE_TIMEOUT: 'Response timeout. Please try again.',
} as const;

