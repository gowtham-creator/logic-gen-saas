/**
 * Default values
 */
export const DEFAULTS = {
  // User
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'Admin123!', // Must meet password complexity requirements
  ADMIN_FIRST_NAME: 'Admin',
  ADMIN_LAST_NAME: 'User',
  
  // Client
  DEFAULT_CLIENT_NAME: 'Default Admin Client',
  DEFAULT_CLIENT_SUBDOMAIN: 'admin',
  
  // Role
  ADMIN_ROLE_NAME: 'Admin',
  ADMIN_ROLE_DESCRIPTION: 'Full access administrator role',
  
  // Plans
  PLANS: {
    BASIC: {
      NAME: 'basic',
      DESCRIPTION: 'Basic plan with limited features',
      PRICE: 29.99,
      BILLING_PERIOD: 'monthly',
    },
    PROFESSIONAL: {
      NAME: 'professional',
      DESCRIPTION: 'Professional plan with full features',
      PRICE: 99.99,
      BILLING_PERIOD: 'monthly',
    },
    ENTERPRISE: {
      NAME: 'enterprise',
      DESCRIPTION: 'Enterprise plan with all features',
      PRICE: 299.99,
      BILLING_PERIOD: 'monthly',
    },
  },
  
  // Feature toggles
  FEATURE_TOGGLES: {
    SSO_ENABLED: false,
    API_KEYS_ENABLED: true,
    AUDIT_LOGGING_ENABLED: true,
  },
  
  // Theme
  THEME_COLORS: {
    PRIMARY: '#3b82f6',
    SECONDARY: '#8b5cf6',
    ACCENT: '#10b981',
    BACKGROUND: '#ffffff',
    TEXT: '#1f2937',
  },
} as const;

