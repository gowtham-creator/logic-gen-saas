/**
 * UI Messages and Labels
 */
export const MESSAGES = {
  // Success messages
  SUCCESS: {
    ROLE_CREATED: 'Role created successfully',
    ROLE_UPDATED: 'Role updated successfully',
    ROLE_DELETED: 'Role deleted successfully',
    TEMPLATE_CREATED: 'Template created successfully',
    TEMPLATE_UPDATED: 'Template updated successfully',
    TEMPLATE_DELETED: 'Template deleted successfully',
    PERMISSION_UPDATED: 'Permission updated successfully',
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deleted successfully',
    PASSWORD_RESET: 'Password reset successfully. Please login with your new password.',
    API_KEY_CREATED: 'API key created successfully',
          API_KEY_UPDATED: 'API key updated successfully',
          API_KEY_REVOKED: 'API key revoked successfully',
          API_KEY_DELETED: 'API key deleted successfully',
    CLIENT_CREATED: 'Client created successfully',
    CLIENT_UPDATED: 'Client updated successfully',
    CLIENT_DELETED: 'Client deleted successfully',
    PLAN_CREATED: 'Plan created successfully',
    PLAN_UPDATED: 'Plan updated successfully',
    PLAN_DELETED: 'Plan deleted successfully',
  },
  
  // Error messages
  ERROR: {
    GENERIC: 'An error occurred',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    NOT_FOUND: 'Resource not found',
    VALIDATION_FAILED: 'Validation failed',
    LOAD_FAILED: 'Failed to load data',
    SAVE_FAILED: 'Failed to save',
    DELETE_FAILED: 'Failed to delete',
    PERMISSION_DENIED: 'You do not have permission to perform this action',
  },
  
  // Warning messages
  WARNING: {
    DESCRIPTION_REQUIRED: 'Description is required',
    CONFIRM_DELETE: (resource: string) => `Are you sure you want to delete this ${resource}?`,
    CONFIRM_DELETE_ROLE: 'Are you sure you want to delete this role?',
    CONFIRM_DELETE_TEMPLATE: 'Are you sure you want to delete this template? Roles using this template will lose their permissions.',
    CONFIRM_DELETE_CLIENT: 'Are you sure you want to delete this client? This will delete all associated data.',
    CONFIRM_DELETE_PLAN: 'Are you sure you want to delete this plan?',
    CONFIRM_DELETE_USER: 'Are you sure you want to delete this user?',
  },
  
  // Info messages
  INFO: {
    LOADING: 'Loading...',
    SAVING: 'Saving...',
    NO_DATA: 'No data available',
    SELECT_TEMPLATE: 'Select a template to automatically sync permissions',
    TEMPLATE_MANAGED: 'Permissions are managed by the selected template',
  },
  
  // Error page messages
  ERROR_PAGE: {
    NOT_FOUND_TITLE: 'Page Not Found',
    NOT_FOUND_MESSAGE: "The page you're looking for doesn't exist or has been moved.",
    PERMISSION_DENIED_TITLE: 'Access Denied',
    PERMISSION_DENIED_MESSAGE: 'You do not have permission to access this page.',
    PERMISSION_DENIED_DETAIL: (resource?: string, action?: string) => 
      resource && action 
        ? `You don't have permission to ${action} ${resource}.`
        : 'Please contact your administrator if you believe this is an error.',
  },
} as const;

/**
 * Form labels
 */
export const LABELS = {
  // Common
  NAME: 'Name',
  DESCRIPTION: 'Description',
  STATUS: 'Status',
  ACTIONS: 'Actions',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  EDIT: 'Edit',
  CREATE: 'Create',
  UPDATE: 'Update',
  CLOSE: 'Close',
  
  // Roles
  ROLE_NAME: 'Role Name',
  PARENT_ROLE: 'Parent Role',
  ROLE_TEMPLATE: 'Role Template',
  NO_TEMPLATE: 'No Template (Manual Permissions)',
  PERMISSIONS: 'Permissions',
  MANaged_BY_TEMPLATE: 'Managed by Template',
  
  // Templates
  TEMPLATE_NAME: 'Template Name',
  TEMPLATE_DESCRIPTION: 'Template Description',
  
  // Navigation
  ROLES_PERMISSIONS: 'Roles & Permissions',
  ROLE_TEMPLATES: 'Role Templates',
  API_KEYS: 'API Keys',
  THEME: 'Theme',
  AUDIT_LOGS: 'Audit Logs',
  CLIENT_ADMIN: 'Client Admin',
  SUPER_ADMIN: 'Super Admin',
  LOGOUT: 'Logout',
} as const;

