/**
 * Authentication-related types
 */

// Basic User type for authentication (simplified)
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: {
    id: string;
    name: string;
  };
  isSuperAdmin?: boolean;
  isDeveloper?: boolean;
}

// Re-export User from user.types for backward compatibility
export type { User } from './user.types';

export interface LoginCredentials {
  email: string;
  password: string;
  deviceInfo?: any; // Device information for tracking
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TempUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

