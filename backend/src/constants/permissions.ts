/**
 * Permission resource and action constants
 */
export const PERMISSION_RESOURCES = {
  ROLE: 'role',
  ROLE_TEMPLATE: 'role_template',
  USER: 'user',
  API_KEY: 'api-key',
  WEBHOOK: 'webhook',
  CLIENT_SETTINGS: 'client-settings',
  THEME: 'theme',
  AUDIT_LOG: 'audit-log',
  PERMISSION: 'permission',
  WORKFLOW: 'workflow',
} as const;

export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MFA_RESET: 'mfa-reset',
} as const;

/**
 * UI Element IDs for permissions
 */
export const ELEMENT_IDS = {
  // Buttons
  BTN_CREATE_ROLE: 'btn-create-role',
  BTN_EDIT_ROLE: 'btn-edit-role',
  BTN_DELETE_ROLE: 'btn-delete-role',
  BTN_CREATE_TEMPLATE: 'btn-create-template',
  BTN_EDIT_TEMPLATE: 'btn-edit-template',
  BTN_DELETE_TEMPLATE: 'btn-delete-template',
  BTN_CREATE_USER: 'btn-create-user',
  BTN_EDIT_USER: 'btn-edit-user',
  BTN_CHANGE_PASSWORD: 'btn-change-password',
  BTN_TOGGLE_USER_STATUS: 'btn-toggle-user-status',
  BTN_DELETE_USER: 'btn-delete-user',
  BTN_CREATE_API_KEY: 'btn-create-api-key',
  BTN_EDIT_API_KEY: 'btn-edit-api-key',
  BTN_DELETE_API_KEY: 'btn-delete-api-key',
  BTN_CREATE_WEBHOOK: 'btn-create-webhook',
  BTN_EDIT_WEBHOOK: 'btn-edit-webhook',
  BTN_DELETE_WEBHOOK: 'btn-delete-webhook',
  BTN_EDIT_PERMISSION: 'btn-edit-permission',
  BTN_SAVE_SETTINGS: 'btn-save-settings',
  BTN_SAVE_THEME: 'btn-save-theme',
  BTN_CREATE_WORKFLOW: 'btn-create-workflow',
  BTN_EDIT_WORKFLOW: 'btn-edit-workflow',
  BTN_DELETE_WORKFLOW: 'btn-delete-workflow',
  BTN_VIEW_WORKFLOW_FILES: 'btn-view-workflow-files',
  BTN_DOWNLOAD_WORKFLOW_FILE: 'btn-download-workflow-file',
  BTN_UPLOAD_WORKFLOW_FILE: 'btn-upload-workflow-file',
  BTN_DELETE_WORKFLOW_FILE: 'btn-delete-workflow-file',
  BTN_TOGGLE_WORKFLOW_STATUS: 'btn-toggle-workflow-status',
  BTN_RESET_MFA: 'btn-reset-mfa',
  
  // Tables
  TABLE_ROLES: 'table-roles',
  TABLE_TEMPLATES: 'table-templates',
  TABLE_USERS: 'table-users',
  TABLE_API_KEYS: 'table-api-keys',
  TABLE_WEBHOOKS: 'table-webhooks',
  TABLE_AUDIT_LOGS: 'table-audit-logs',
  TABLE_WORKFLOWS: 'table-workflows',
  
  // Sidebar
  SIDEBAR_USERS: 'sidebar-users',
  SIDEBAR_ROLES: 'sidebar-roles',
  SIDEBAR_TEMPLATES: 'sidebar-templates',
  SIDEBAR_PERMISSIONS: 'sidebar-permissions',
  SIDEBAR_API_KEYS: 'sidebar-api-keys',
  SIDEBAR_WEBHOOKS: 'sidebar-webhooks',
  SIDEBAR_THEME: 'sidebar-theme',
  SIDEBAR_AUDIT: 'sidebar-audit',
  SIDEBAR_WORKFLOWS: 'sidebar-workflows',
  
  // Pages
  PAGE_CLIENT_SETTINGS: 'page-client-settings',
  PAGE_THEME: 'page-theme',
} as const;

