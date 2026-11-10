/**
 * User-related types
 */

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleId?: string;
  isActive?: boolean;
  mustResetPassword?: boolean;
  clientId: string;
}

export interface UpdateUserDto {
  // email is intentionally excluded - it cannot be updated
  password?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string | null;
  isActive?: boolean;
  mustResetPassword?: boolean;
}

