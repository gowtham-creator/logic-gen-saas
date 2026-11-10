import { User } from '../entities/User';
import { TenantRequest } from '../types/middleware.types';
import { LoginDto, AuthTokens } from '../types/auth.types';

/**
 * Authentication service interface
 * Handles user authentication, token management, and password operations
 */
export interface IAuthService {
  /**
   * Authenticate a user with email and password
   * @param data - Login credentials (email and password)
   * @param req - Optional tenant request context
   * @returns User object, auth tokens, and optional flags for password reset or MFA requirements
   * @throws Error if credentials are invalid or user is not found
   */
  login(
    data: LoginDto,
    req?: TenantRequest
  ): Promise<{
    user: User;
    tokens: AuthTokens;
    mustResetPassword?: boolean;
    requiresMFA?: boolean;
    requiresMFASetup?: boolean;
  }>;

  /**
   * Refresh an expired access token using a valid refresh token
   * @param refreshToken - The refresh token to use for generating new tokens
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns New access and refresh tokens
   * @throws Error if refresh token is invalid or expired
   */
  refreshToken(refreshToken: string, clientId: string, req?: TenantRequest): Promise<AuthTokens>;

  /**
   * Logout a user by invalidating their refresh token
   * @param userId - The ID of the user to logout
   * @param req - Optional tenant request context
   * @param accessToken - Optional access token to blacklist
   * @throws Error if user is not found
   */
  logout(userId: string, req?: TenantRequest, accessToken?: string): Promise<void>;

  /**
   * Generate JWT access and refresh tokens for a user
   * @param user - The user entity to generate tokens for
   * @param clientId - Optional client ID (defaults to user's clientId)
   * @returns Access token and refresh token
   */
  generateTokens(user: User, clientId?: string): Promise<AuthTokens>;

  /**
   * Save a refresh token to the database for a user
   * @param userId - The ID of the user
   * @param refreshToken - The refresh token to save
   * @param req - Optional tenant request context
   * @throws Error if user is not found
   */
  saveRefreshToken(userId: string, refreshToken: string, req?: TenantRequest): Promise<void>;

  /**
   * Hash a plain text password using bcrypt
   * @param password - The plain text password to hash
   * @returns The hashed password
   */
  hashPassword(password: string): Promise<string>;

  /**
   * Retrieve a user by ID
   * @param userId - The ID of the user to retrieve
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns The user entity or null if not found
   */
  getUserById(userId: string, clientId: string, req?: TenantRequest): Promise<User | null>;
  updateLastLogin(userId: string, req?: TenantRequest): Promise<void>;
  
  /**
   * Clear user blacklist (useful when user logs in successfully)
   * @param userId - The ID of the user
   */
  clearUserBlacklist(userId: string): Promise<void>;
}

