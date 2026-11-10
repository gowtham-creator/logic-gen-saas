import { apiClient } from './api';
import type { AuthUser, LoginCredentials, AuthTokens } from '@/types/auth.types';
import type { User } from '@/types/user.types';

export type { User, LoginCredentials, AuthTokens };

// For backward compatibility, also export AuthUser as User in auth context
export type { AuthUser };

export async function login(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens?: AuthTokens; mustResetPassword?: boolean }> {
  // Collect device information if not provided
  if (!credentials.deviceInfo && typeof window !== 'undefined') {
    const { collectDeviceInfo } = await import('./deviceInfo');
    credentials.deviceInfo = collectDeviceInfo();
  }
  return apiClient.post('/api/auth/login', credentials);
}

export async function resetPassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiClient.post('/api/auth/reset-password', { currentPassword, newPassword });
}

export async function forceResetPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  return apiClient.post('/api/auth/force-reset-password', { email, currentPassword, newPassword });
}

export async function logout(): Promise<void> {
  try {
    const response = await apiClient.post<{ message: string; ssoLogoutUrl?: string }>('/api/auth/logout');
    
    // Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('isSuperAdmin');
      localStorage.removeItem('isDeveloper');
    }

    // If SSO logout URL is provided, redirect to OIDC provider's logout endpoint
    // This will log the user out from the SSO provider as well
    if (response.ssoLogoutUrl) {
      window.location.href = response.ssoLogoutUrl;
      return; // Don't continue, let the redirect happen
    }
  } catch (error) {
    // Even if API call fails, clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('isSuperAdmin');
      localStorage.removeItem('isDeveloper');
    }
    throw error;
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('accessToken');
}

