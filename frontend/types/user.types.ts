/**
 * User-related types
 */

import { Role } from './role.types';

export interface User {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId?: string | null;
  role?: Role | null;
  isActive?: boolean;
  mustResetPassword?: boolean;
  password?: string;
  source?: string; // 'direct', 'sso', 'ldap', etc.
  externalId?: string; // Unique ID from external system
  mfaEnabled?: boolean; // Whether MFA is enabled for this user
  mfaVerified?: boolean; // Whether MFA setup is verified
  createdAt?: string;
  updatedAt?: string;
}

// Extended User type for forms (allows partial data)
export type UserFormData = Partial<User>;

