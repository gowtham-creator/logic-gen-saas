import axios, { AxiosInstance, AxiosError } from 'axios';
import type { ApiResponse } from '@/types/common.types';
import { notificationService } from '@/lib/notifications';

export type { ApiResponse };

class ApiClient {
  private client: AxiosInstance;
  private verifyingFlags = false; // Prevent multiple simultaneous verifications
  private pendingRequests = new Map<string, Promise<any>>(); // Request deduplication
  private csrfToken: string | null = null;
  private csrfTokenPromise: Promise<string> | null = null; // Prevent multiple simultaneous CSRF token fetches
  private revocationMessageShown = false; // Prevent showing revocation message multiple times

  private getBaseURL(): string {
    // In browser, use relative URLs (Next.js rewrites handle proxying)
    if (typeof window !== 'undefined') {
      // Use relative URL - Next.js rewrite will proxy to backend
      return '';
    }
    // Server-side, use environment variable or default
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Fetch CSRF token from the backend
   * This will set the csrf-secret cookie and return a token
   */
  private async fetchCsrfToken(): Promise<string> {
    // If there's already a fetch in progress, wait for it
    if (this.csrfTokenPromise) {
      return this.csrfTokenPromise;
    }

    // Create new fetch promise
    this.csrfTokenPromise = (async () => {
      try {
        const response = await fetch(`${this.getBaseURL()}/api/auth/csrf-token`, {
          method: 'GET',
          credentials: 'include', // Important: include cookies
        });

        if (!response.ok) {
          throw new Error('Failed to fetch CSRF token');
        }

        const data = await response.json();
        if (data.success && data.data?.token) {
          this.csrfToken = data.data.token;
          return data.data.token;
        }
        throw new Error('Invalid CSRF token response');
      } catch (error) {
        // Clear promise on error so we can retry
        this.csrfTokenPromise = null;
        throw error;
      } finally {
        // Clear promise after a short delay to allow refresh
        setTimeout(() => {
          this.csrfTokenPromise = null;
        }, 1000);
      }
    })();

    return this.csrfTokenPromise;
  }

  /**
   * Verify and sync localStorage flags with backend user data
   * This prevents users from manually changing localStorage to gain unauthorized access
   * 
   * Security: Even if a user changes localStorage values, the backend will:
   * 1. Verify the actual user permissions from the database
   * 2. Reject unauthorized requests with 403 Forbidden
   * 3. This function syncs localStorage to match backend reality
   */
  async verifyUserFlags(): Promise<void> {
    if (typeof window === 'undefined' || this.verifyingFlags) {
      return;
    }

    // Only verify if user is authenticated
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return;
    }

    try {
      this.verifyingFlags = true;
      const response = await this.client.get<ApiResponse<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isSuperAdmin: boolean;
        isDeveloper: boolean;
        isActive: boolean;
      }>>('/api/auth/me');

      if (response.data.success && response.data.data) {
        const user = response.data.data;

        // Sync flags with backend data
        if (user.isSuperAdmin) {
          localStorage.setItem('isSuperAdmin', 'true');
        } else {
          localStorage.removeItem('isSuperAdmin');
        }

        if (user.isDeveloper) {
          localStorage.setItem('isDeveloper', 'true');
        } else {
          localStorage.removeItem('isDeveloper');
        }

        // Update user object in localStorage
        localStorage.setItem('user', JSON.stringify({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isSuperAdmin: user.isSuperAdmin,
          isDeveloper: user.isDeveloper,
        }));
      }
    } catch (error) {
      // If verification fails (e.g., token expired), clear flags
      // Ignore errors in background verification
    } finally {
      this.verifyingFlags = false;
    }
  }

  constructor() {
    this.client = axios.create({
      baseURL: this.getBaseURL(),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use(async (config) => {
      if (typeof window !== 'undefined') {
        // Use regular access token (works for both regular users and super admins)
        const token = localStorage.getItem('accessToken');

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;

          // Add client device ID header for device validation
          const clientDeviceId = localStorage.getItem('deviceId');
          if (clientDeviceId) {
            config.headers['x-client-device-id'] = clientDeviceId;
          }

          // Verify flags periodically (every 5 minutes or on critical routes)
          const lastVerification = localStorage.getItem('lastFlagVerification');
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;

          // Verify on critical routes or if last verification was > 5 minutes ago
          const criticalRoutes = ['/api/clients', '/api/super-admin', '/api/developer'];
          const isCriticalRoute = criticalRoutes.some(route => config.url?.includes(route));

          if (isCriticalRoute || !lastVerification || (now - parseInt(lastVerification)) > fiveMinutes) {
            // Run verification in background (don't block request)
            this.verifyUserFlags().then(() => {
              localStorage.setItem('lastFlagVerification', now.toString());
            }).catch(() => {
              // Ignore errors in background verification
            });
          }
        }

        // Add CSRF token for state-changing operations (POST, PUT, DELETE, PATCH)
        // Skip for GET, HEAD, OPTIONS requests and API key requests
        const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '');
        const hasApiKey = config.headers?.['x-api-key'];

        if (isStateChanging && !hasApiKey) {
          // Skip CSRF for login endpoint (first request will set the secret cookie)
          const isLoginEndpoint = config.url?.includes('/api/auth/login');

          if (!isLoginEndpoint) {
            try {
              // Fetch CSRF token if we don't have one
              if (!this.csrfToken) {
                await this.fetchCsrfToken();
              }

              // Include CSRF token in header
              if (this.csrfToken) {
                config.headers['x-csrf-token'] = this.csrfToken;
              }
            } catch (error) {
              // If CSRF token fetch fails, continue without it
              // The backend will handle the first request gracefully
              console.warn('Failed to fetch CSRF token:', error);
            }
          }
        }
      }

      // Ensure FormData requests don't have Content-Type set (let browser set it with boundary)
      if (config.data instanceof FormData) {
        delete config.headers?.['Content-Type'];
        delete config.headers?.['content-type'];
      }

      return config;
    });

    // Handle token refresh and access denied
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse>) => {
        // Handle CSRF token errors - clear token and retry once
        if (error.response?.status === 403 && error.response?.data?.error?.code === 'CSRF_TOKEN_INVALID') {
          // Clear CSRF token and retry the request
          this.csrfToken = null;
          this.csrfTokenPromise = null;

          // Retry the request with a fresh CSRF token
          if (error.config) {
            try {
              await this.fetchCsrfToken();
              if (this.csrfToken && error.config.headers) {
                error.config.headers['x-csrf-token'] = this.csrfToken;
                return this.client.request(error.config);
              }
            } catch {
              // If retry fails, continue with error
            }
          }
          return Promise.reject(error);
        }

        // Handle 403 Forbidden (access denied) for super admin and developer routes
        if (error.response?.status === 403 && typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          const isSuperAdminRoute = error.config?.url?.includes('/api/clients') ||
            error.config?.url?.includes('/api/plans') ||
            error.config?.url?.includes('/api/theme/global') ||
            error.config?.url?.includes('/api/super-admin') ||
            currentPath.startsWith('/admin/super');
          const isDeveloperRoute = error.config?.url?.includes('/api/developer/') ||
            currentPath.startsWith('/developer/');

          // Determine resource name for logging
          let resource = 'this resource';
          if (isSuperAdminRoute) {
            resource = 'Super Admin';
          } else if (isDeveloperRoute) {
            resource = 'Developer Dashboard';
          }

          // Redirect to unauthorized page instead of login
          // This allows logging the attempt and showing a message
          if (currentPath !== '/unauthorized' && !currentPath.startsWith('/unauthorized')) {
            // Log the attempt first (will be done by unauthorized page)
            window.location.href = `/unauthorized?path=${encodeURIComponent(currentPath)}&resource=${encodeURIComponent(resource)}`;
          }
          return Promise.reject(error);
        }

        if (error.response?.status === 401 && typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          const errorCode = error.response?.data?.error?.code;

          // If token is revoked (e.g., device revoked, password changed, etc.), show message and logout
          const errorMessage = error.response?.data?.error?.message || '';
          if (errorCode === 'TOKEN_REVOKED' || errorMessage.includes('revoked') || errorMessage.includes('Revoked')) {
            // Prevent showing the message multiple times
            if (this.revocationMessageShown) {
              return Promise.reject(error);
            }
            this.revocationMessageShown = true;

            // Determine the specific reason for revocation based on error message
            let message = 'Your session has been revoked. Please log in again.';
            if (errorMessage.toLowerCase().includes('device') || errorMessage.toLowerCase().includes('revoked device')) {
              message = 'This device has been revoked. You will be logged out shortly. Please log in again from an authorized device.';
            } else if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('password changed')) {
              message = 'Your password has been changed. You will be logged out shortly. Please log in again with your new password.';
            } else if (errorMessage) {
              // Use the error message from backend if available
              message = errorMessage;
            }

            // Show notification message with longer duration so user can read it
            notificationService.error(message, 8000); // 8 seconds duration

            // Clear all auth data
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('isSuperAdmin');
            localStorage.removeItem('isDeveloper');

            // Wait a moment to show the message, then redirect to login
            if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
              setTimeout(() => {
                window.location.href = '/login?message=' + encodeURIComponent(message);
              }, 5000); // 5 second delay to show the notification
            }
            return Promise.reject(error);
          }

          // Don't redirect if we're already on a login page
          if (currentPath === '/login' || currentPath.startsWith('/login')) {
            return Promise.reject(error);
          }

          // Don't show error or redirect immediately on page load - let the component handle it
          // This prevents the flash of unauthorized screen
          if (error.config?.url && (
            error.config.url.includes('/api/roles') ||
            error.config.url.includes('/api/role-templates') ||
            error.config.url.includes('/api/auth/me/permissions') ||
            error.config.url.includes('/api/auth/me') ||
            error.config.url.includes('/api/theme/global')
          )) {
            // These are initial load requests - let the component handle the redirect
            // Return the error so the component can check authentication
            return Promise.reject(error);
          }

          // Verify and sync localStorage flags with backend (security check)
          await this.verifyUserFlags();

          // Check if this is a super admin route or user has super admin flag
          const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';
          const isDeveloper = localStorage.getItem('isDeveloper') === 'true';
          const isSuperAdminRoute = error.config?.url?.includes('/super-admin/') ||
            currentPath.startsWith('/admin/super');
          const isDeveloperRoute = error.config?.url?.includes('/api/developer/') ||
            currentPath.startsWith('/developer/');

          // Handle super admin or developer token refresh
          if (isSuperAdmin || isSuperAdminRoute || isDeveloper || isDeveloperRoute) {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              try {
                // Get clientId from stored user or token
                const userStr = localStorage.getItem('user');
                let clientId: string | undefined;
                if (userStr) {
                  try {
                    const user = JSON.parse(userStr);
                    clientId = user.clientId;
                  } catch { }
                }

                if (!clientId) {
                  // Try to decode token to get clientId (manual decode since we're in browser)
                  const token = localStorage.getItem('accessToken');
                  if (token) {
                    try {
                      // JWT format: header.payload.signature
                      const parts = token.split('.');
                      if (parts.length === 3) {
                        // Decode the payload (second part)
                        const payload = JSON.parse(atob(parts[1]));
                        clientId = payload?.clientId;
                      }
                    } catch {
                      // Ignore decode errors
                    }
                  }
                }

                // Use appropriate refresh endpoint based on user type
                const refreshEndpoint = isDeveloper
                  ? '/api/developer/auth/refresh'
                  : '/api/super-admin/auth/refresh';

                const baseURL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
                // Refresh endpoints are public - don't send Authorization header
                const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
                  `${baseURL}${refreshEndpoint}`,
                  { refreshToken, clientId },
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      // Explicitly don't include Authorization header for refresh endpoints
                    }
                  }
                );
                if (response.data.success && response.data.data) {
                  localStorage.setItem('accessToken', response.data.data.accessToken);
                  localStorage.setItem('refreshToken', response.data.data.refreshToken);
                  // Retry original request
                  if (error.config) {
                    error.config.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
                    return this.client.request(error.config);
                  }
                }
              } catch {
                // Refresh failed, redirect to super admin login
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                localStorage.removeItem('isSuperAdmin');
                if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
                  window.location.href = '/login';
                }
              }
            } else {
              // No refresh token, redirect to login
              if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
                window.location.href = '/login';
              }
            }
          } else {
            // Handle regular user token refresh
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              try {
                const baseURL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
                // Refresh endpoints are public - don't send Authorization header
                const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
                  `${baseURL}/api/auth/refresh`,
                  { refreshToken },
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      // Explicitly don't include Authorization header for refresh endpoints
                    }
                  }
                );
                if (response.data.success && response.data.data) {
                  localStorage.setItem('accessToken', response.data.data.accessToken);
                  localStorage.setItem('refreshToken', response.data.data.refreshToken);
                  // Retry original request
                  if (error.config) {
                    error.config.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
                    return this.client.request(error.config);
                  }
                }
              } catch (refreshError: any) {
                // Check if refresh failed due to revoked token
                const refreshErrorCode = refreshError.response?.data?.error?.code;
                const refreshErrorMessage = refreshError.response?.data?.error?.message || '';
                if (refreshErrorCode === 'TOKEN_REVOKED' || refreshErrorMessage.includes('revoked') || refreshErrorMessage.includes('Revoked')) {
                  // Only show message if not already shown (to prevent duplicates)
                  if (!this.revocationMessageShown) {
                    this.revocationMessageShown = true;

                    // Determine the specific reason for revocation based on error message
                    let message = 'Your session has been revoked. Please log in again.';
                    if (refreshErrorMessage.toLowerCase().includes('device') || refreshErrorMessage.toLowerCase().includes('revoked device')) {
                      message = 'This device has been revoked. You will be logged out shortly. Please log in again from an authorized device.';
                    } else if (refreshErrorMessage.toLowerCase().includes('password') || refreshErrorMessage.toLowerCase().includes('password changed')) {
                      message = 'Your password has been changed. You will be logged out shortly. Please log in again with your new password.';
                    } else if (refreshErrorMessage) {
                      // Use the error message from backend if available
                      message = refreshErrorMessage;
                    }

                    // Show notification message with longer duration so user can read it
                    notificationService.error(message, 8000); // 8 seconds duration

                    // Wait a moment to show the message, then redirect to login
                    if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
                      setTimeout(() => {
                        window.location.href = '/login?message=' + encodeURIComponent(message);
                      }, 5000); // 5 second delay to show the notification
                    }
                  }

                  // Token was revoked, clear everything
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  localStorage.removeItem('user');
                  localStorage.removeItem('isSuperAdmin');
                  localStorage.removeItem('isDeveloper');
                } else {
                  // Other refresh error, just clear tokens
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
                    window.location.href = '/login';
                  }
                }
              }
            } else {
              // No refresh token, redirect to login only if not already there
              if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
                window.location.href = '/login';
              }
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  }

  async get<T>(url: string, config?: { params?: Record<string, any> }): Promise<T> {
    // Create a unique key for request deduplication (include URL and params)
    const requestKey = config?.params ? `${url}?${new URLSearchParams(config.params).toString()}` : url;

    // Check if there's already a pending request for this URL (request deduplication)
    const pendingRequest = this.pendingRequests.get(requestKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Create new request
    const requestPromise = this.client.get<ApiResponse<T>>(url, config)
      .then((response) => {
        if (!response.data.success) {
          throw new Error(response.data.error?.message || 'Request failed');
        }
        return response.data.data as T;
      })
      .finally(() => {
        // Remove from pending requests after completion
        this.pendingRequests.delete(requestKey);
      });

    // Store pending request
    this.pendingRequests.set(requestKey, requestPromise);
    return requestPromise;
  }

  async post<T>(url: string, data?: unknown, config?: { headers?: Record<string, string> }): Promise<T> {
    let requestConfig: any = {
      ...config,
    };

    // Handle FormData specially - don't set Content-Type, let axios/browser set it with boundary
    if (data instanceof FormData) {
      requestConfig.headers = {
        ...config?.headers,
      };
      // Explicitly remove Content-Type to let axios set it automatically with the correct boundary
      delete requestConfig.headers?.['Content-Type'];
      delete requestConfig.headers?.['content-type'];
    } else {
      requestConfig.headers = {
        ...this.client.defaults.headers,
        ...config?.headers,
      };
    }

    const response = await this.client.post<ApiResponse<T>>(url, data, requestConfig);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  }
}

export const apiClient = new ApiClient();

