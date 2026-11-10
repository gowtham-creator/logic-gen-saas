/**
 * Test Credentials Configuration
 * 
 * These credentials should match the users created by the seed script.
 * You can override them using environment variables.
 */

export const TEST_CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin123!',
  },
  superAdmin: {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@example.com',
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin123!',
  },
  developer: {
    email: process.env.TEST_DEVELOPER_EMAIL || 'developer@example.com',
    password: process.env.TEST_DEVELOPER_PASSWORD || 'Developer123!',
  },
} as const;

