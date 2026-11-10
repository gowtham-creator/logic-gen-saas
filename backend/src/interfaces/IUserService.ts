import { User } from '../entities/User';
import { TenantRequest } from '../types/middleware.types';
import { CreateUserDto, UpdateUserDto } from '../types/user.types';

/**
 * User service interface
 * Handles user CRUD operations, password management, and email validation
 */
export interface IUserService {
  /**
   * Create a new user in the system
   * @param data - User creation data (email, password, firstName, lastName, etc.)
   * @param req - Optional tenant request context
   * @returns The created user entity
   * @throws Error if email already exists or validation fails
   */
  createUser(data: CreateUserDto, req?: TenantRequest): Promise<User>;

  /**
   * Update an existing user's information
   * @param id - The ID of the user to update
   * @param clientId - The client/tenant ID
   * @param data - Partial user data to update
   * @param req - Optional tenant request context
   * @returns The updated user entity
   * @throws Error if user is not found or validation fails
   */
  updateUser(id: string, clientId: string, data: UpdateUserDto, req?: TenantRequest): Promise<User>;

  /**
   * Reset a user's password
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param newPassword - The new plain text password (will be hashed)
   * @param req - Optional tenant request context
   * @returns The updated user entity
   * @throws Error if user is not found, is SSO user, or validation fails
   */
  resetPassword(userId: string, clientId: string, newPassword: string, req?: TenantRequest): Promise<User>;

  /**
   * Retrieve a user by ID
   * @param id - The ID of the user to retrieve
   * @param clientId - The client/tenant ID
   * @param includePasswordHash - Whether to include the password hash in the result (default: false)
   * @param req - Optional tenant request context
   * @returns The user entity or null if not found
   */
  getUserById(id: string, clientId: string, includePasswordHash?: boolean, req?: TenantRequest): Promise<User | null>;

  /**
   * List all users for a specific client/tenant
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns Array of user entities (excluding soft-deleted users)
   */
  listUsers(clientId: string, req?: TenantRequest): Promise<User[]>;

  /**
   * Soft delete a user (sets deletedAt timestamp)
   * @param id - The ID of the user to delete
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @throws Error if user is not found
   */
  deleteUser(id: string, clientId: string, req?: TenantRequest): Promise<void>;

  /**
   * Check if an email address is available for use
   * @param email - The email address to check
   * @param excludeClientId - Optional client ID to exclude from the check (for cross-tenant checks)
   * @returns Object with availability status and optional message
   */
  checkEmailAvailability(email: string, excludeClientId?: string): Promise<{ available: boolean; message?: string }>;

  /**
   * Find or create a user from SSO authentication
   * @param userInfo - User information from SSO provider
   * @param clientId - The client/tenant ID
   * @param defaultRoleId - Default role ID to assign to new SSO users
   * @param req - Optional tenant request context
   * @returns The user entity (existing or newly created)
   * @throws Error if user creation fails or default role is missing
   */
  findOrCreateSSOUser(
    userInfo: { email: string; firstName: string; lastName: string; externalId: string },
    clientId: string,
    defaultRoleId: string | null,
    req?: TenantRequest
  ): Promise<User>;
}

