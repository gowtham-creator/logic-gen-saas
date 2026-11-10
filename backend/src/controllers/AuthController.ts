import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { TenantRequest } from '../types/middleware.types';
import { AuthenticatedRequest } from '../types/middleware.types';
import { IAuthService } from '../interfaces/IAuthService';
import { LoginDto } from '../types/auth.types';
import { IUserService } from '../interfaces/IUserService';
import { PermissionService } from '../services/PermissionService';
import { ClientService } from '../services/ClientService';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errors';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { logger } from '../utils/logger';
import { getSecurityMonitoringService, SecurityEventType } from '../services/SecurityMonitoringService';
import { AUTH_CONSTANTS } from '../constants/auth';
import { SECURITY_CONSTANTS } from '../constants/security';
import { config } from '../config/config';
import { getSSOService } from '../services/SSOService';
import { getSSOStateService } from '../services/SSOStateService';
import { getSSOConfigEncryptionService } from '../services/SSOConfigEncryptionService';

/**
 * Authentication controller
 * Handles HTTP requests for user authentication, token management, and user info
 */
export class AuthController {
  /**
   * @param authService - Authentication service for login, token operations
   * @param userService - User service for user management operations
   * @param auditService - Audit service for logging authentication events
   * @param permissionService - Permission service for checking user permissions
   */
  private clientService: ClientService;

  constructor(
    private authService: IAuthService,
    private userService: IUserService,
    private auditService: AuditService,
    private permissionService: PermissionService
  ) {
    this.clientService = new ClientService();
  }

  /**
   * Handle user login request
   * @param req - Request containing email, password, and clientId
   * @param res - Response object
   * @returns User object and tokens, or flags for password reset/MFA requirements
   */
  async login(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Email and password are required', 400);
        return;
      }

      // All users (including super admin and developer) must go through normal login flow with clientId
      if (!req.clientId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Client ID is required', 400);
        return;
      }

      let user: User | null = null;
      let tokens: any = null;
      let mustResetPassword = false;
      let requiresMFA = false;
      let requiresMFASetup = false;

      try {
        const data: LoginDto = {
          email,
          password,
          clientId: req.clientId,
          deviceInfo: req.body.deviceInfo, // Pass device info if provided - will be stored by AuthService after successful login (or by MFAController after MFA verification)
        };
        const result = await this.authService.login(data, req);
        user = result.user;
        tokens = result.tokens;
        mustResetPassword = result.mustResetPassword || false;
        requiresMFA = (result as any).requiresMFA || false;
        requiresMFASetup = (result as any).requiresMFASetup || false;
      } catch (error: unknown) {
        // Check if error is about account lockout - pass through the actual error message
        const errorMessage = error instanceof Error ? error.message : 'Invalid credentials';
        // Check for account lockout messages (case-insensitive)
        const isAccountLocked = errorMessage.toLowerCase().includes('locked') || 
                                errorMessage.toLowerCase().includes('account is locked') ||
                                errorMessage.toLowerCase().includes('account locked');
        
        if (isAccountLocked) {
          sendError(res, ERROR_CODES.LOGIN_ERROR, errorMessage, 401);
        } else {
          sendError(res, ERROR_CODES.LOGIN_ERROR, 'Invalid credentials', 401);
        }
        return;
      }

      // If password reset is required, return without tokens (check before MFA)
      if (mustResetPassword) {
        sendSuccess(res, {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            source: user.source,
            externalId: user.externalId,
          },
          mustResetPassword: true,
        });
        return;
      }

      // If MFA setup is required (user needs to set up MFA first), return without tokens
      if (requiresMFASetup) {
        sendSuccess(res, {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            source: user.source,
            externalId: user.externalId,
            clientId: user.clientId,
          },
          requiresMFASetup: true,
        });
        return;
      }

      // If MFA is required, return without tokens (check before audit log and token return)
      if (requiresMFA) {
        sendSuccess(res, {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            source: user.source,
            externalId: user.externalId,
            clientId: user.clientId,
          },
          requiresMFA: true,
        });
        return;
      }

      // If we reach here, tokens should already be generated
      // But double-check that tokens exist before proceeding
      if (!tokens || !tokens.accessToken) {
        sendError(res, ERROR_CODES.LOGIN_ERROR, 'Failed to generate authentication tokens', 500);
        return;
      }

      // Audit log
      await this.auditService.log({
        clientId: user.clientId || req.clientId || undefined,
        userId: user.id,
        action: 'user.login',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      // Log security event for monitoring
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.LOGIN_SUCCESS,
        severity: 'low',
        message: 'User logged in successfully',
        metadata: {
          userId: user.id,
          clientId: user.clientId || req.clientId,
          subdomain: (req as any).tenant?.subdomain || undefined,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });

      sendSuccess(res, {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
          isDeveloper: user.isDeveloper,
          source: user.source,
          externalId: user.externalId,
        },
        tokens,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      // Don't log email (PII) - secureLogger will redact it anyway, but better to not include it
      logger.error('Login failed', { error: errorMessage });
      
      // Log security event for monitoring
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.LOGIN_FAILED,
        severity: 'medium',
        message: 'Login attempt failed',
        metadata: {
          email: req.body.email, // Will be sanitized by security logger
          clientId: req.clientId,
          subdomain: (req as any).tenant?.subdomain || undefined,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          path: req.path,
          error: errorMessage,
        },
        timestamp: new Date(),
      });
      
      sendError(res, ERROR_CODES.LOGIN_ERROR, errorMessage, 401);
    }
  }

  /**
   * Handle token refresh request
   * @param req - Request containing refreshToken and clientId
   * @param res - Response object
   * @returns New access and refresh tokens
   */
  async refresh(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        sendError(res, ERROR_CODES.REFRESH_ERROR, ERROR_MESSAGES.REFRESH_TOKEN_REQUIRED, 400);
        return;
      }

      const tokens = await this.authService.refreshToken(refreshToken, req.clientId!, req);
      sendSuccess(res, tokens);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
      logger.error('Token refresh failed', { error: errorMessage });
      
      // Check if token was revoked and return appropriate error code
      if (errorMessage.includes('revoked') || errorMessage.includes('Revoked')) {
        sendError(res, ERROR_CODES.TOKEN_REVOKED, errorMessage, 401);
      } else {
        sendError(res, ERROR_CODES.REFRESH_ERROR, errorMessage, 401);
      }
    }
  }

  /**
   * Handle user logout request
   * Invalidates the user's refresh token
   * For SSO users, also returns the OIDC provider logout URL
   * @param req - Request containing user ID (from token)
   * @param res - Response object
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let ssoLogoutUrl: string | null = null;

      if (req.userId && req.clientId) {
        // Get user to check if they're an SSO user
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ 
          where: { id: req.userId, clientId: req.clientId },
          relations: ['client']
        });

        // If user is SSO user and client has SSO enabled, generate logout URL
        if (user && user.source === 'sso' && user.client?.ssoConfig?.enabled && user.client.ssoConfig.provider === 'oidc') {
          try {
            const ssoService = getSSOService();
            const oidcConfiguration = await ssoService.getOIDCConfiguration(user.client.ssoConfig);
            
            // Get SSO metadata for logout URL configuration (decrypted from SSOService)
            const encryptionService = getSSOConfigEncryptionService();
            const decryptedConfig = await encryptionService.decryptSSOConfig(user.client.ssoConfig);
            const metadata = decryptedConfig.metadata as any;
            
            // Get frontend URL for post-logout redirect
            // Use configured postLogoutRedirectUri from metadata, or default to login page
            const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
            const host = req.get('x-forwarded-host') || req.get('host') || '';
            const frontendUrl = host ? `${protocol}://${host}` : config.appUrl;
            const postLogoutRedirectUri = metadata?.postLogoutRedirectUri || `${frontendUrl}/login`;

            // Generate logout URL (id_token_hint is optional, we'll generate without it)
            ssoLogoutUrl = await ssoService.generateLogoutUrl(
              oidcConfiguration,
              undefined, // ID token not stored, but logout will still work
              postLogoutRedirectUri,
              metadata // Pass metadata to allow custom logout URL override
            );

            if (ssoLogoutUrl) {
              logger.debug('Generated SSO logout URL', { userId: req.userId, clientId: req.clientId });
            }
          } catch (error: any) {
            logger.warn('Failed to generate SSO logout URL', { 
              error: error.message, 
              userId: req.userId,
              clientId: req.clientId 
            });
            // Continue with normal logout even if SSO logout URL generation fails
          }
        }

        // Extract access token from Authorization header for blacklisting
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.startsWith(AUTH_CONSTANTS.BEARER_PREFIX) 
          ? authHeader.substring(AUTH_CONSTANTS.BEARER_PREFIX_LENGTH) 
          : undefined;
        
        logger.debug('Logout request', {
          userId: req.userId,
          hasAuthHeader: !!authHeader,
          hasAccessToken: !!accessToken,
          tokenLength: accessToken?.length || 0
        });
        
        await this.authService.logout(req.userId, req, accessToken);

        // Log audit event
        await this.auditService.log({
          userId: req.userId,
          clientId: req.clientId,
          action: 'logout',
          resourceType: 'Auth',
          metadata: {
            source: user?.source || 'unknown',
            ssoLogout: !!ssoLogoutUrl,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }, req);
      }

      // Return logout URL if available for SSO users
      sendSuccess(res, { 
        message: SUCCESS_MESSAGES.LOGOUT_SUCCESS,
        ssoLogoutUrl: ssoLogoutUrl || undefined
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      logger.error('Logout failed', { error: errorMessage, userId: req.userId });
      sendError(res, ERROR_CODES.LOGOUT_ERROR, errorMessage, 500);
    }
  }

  /**
   * Get authentication configuration for the current client (public endpoint)
   * Returns SSO configuration and other auth-related settings
   */
  async getAuthConfig(req: TenantRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const client = await this.clientService.getClient(req.clientId);
      if (!client) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Client not found', 404);
        return;
      }

      const ssoEnabled = client.ssoConfig?.enabled || false;
      const ssoProvider = client.ssoConfig?.provider;

      sendSuccess(res, {
        ssoEnabled,
        ssoProvider: ssoEnabled ? ssoProvider : undefined,
        allowPasswordLogin: !ssoEnabled || true, // Can be made configurable in future
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get auth config';
      logger.error('Failed to get auth config', { error: errorMessage, clientId: req.clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  async oidcAuthorize(req: TenantRequest, res: Response): Promise<void> {
    try {
      // Validate client ID
      if (!req.clientId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Client ID is required', 400);
        return;
      }

      // Get client and validate SSO configuration
      const client = await this.clientService.getClient(req.clientId);
      if (!client) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Client not found', 404);
        return;
      }

      if (!client.ssoConfig || !client.ssoConfig.enabled) {
        sendError(res, ERROR_CODES.FORBIDDEN, 'SSO is not enabled for this client', 403);
        return;
      }

      if (client.ssoConfig.provider !== 'oidc') {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'OIDC is not configured for this client', 400);
        return;
      }

      // Get SSO service and state service
      const ssoService = getSSOService();
      const stateService = getSSOStateService();

      // Check if Redis is available (async check)
      const redisAvailable = await stateService.isAvailable();
      if (!redisAvailable) {
        logger.error('SSO State Service Redis is not available', { 
          clientId: req.clientId,
          redisUrl: config.redisUrl ? 'configured' : 'not configured'
        });
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'SSO state service is not available. Redis connection required. Please ensure Redis is running and REDIS_URL is configured.', 500);
        return;
      }

      // Get OIDC configuration
      const oidcConfiguration = await ssoService.getOIDCConfiguration(client.ssoConfig);
      // Generate state and nonce for CSRF protection
      const state = stateService.generateState();
      const nonce = stateService.generateNonce();

      // Generate PKCE code verifier and challenge
      const { codeVerifier, codeChallenge } = await ssoService.generatePKCE();

      // Get frontend URL helper function (for redirect URI)
      const getFrontendUrl = (): string => {
        // Check for X-Forwarded-Proto and X-Forwarded-Host (Cloudflare/proxy)
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('x-forwarded-host') || req.get('host') || '';
        
        // If we have a host, use it
        if (host) {
          // Ensure protocol is https in production (Cloudflare always uses HTTPS)
          const finalProtocol = protocol === 'https' || config.nodeEnv === 'production' ? 'https' : protocol;
          return `${finalProtocol}://${host}`;
        }
        
        // Fallback to config
        return config.appUrl;
      };

      // Get redirect URI from metadata or use default (decrypt first)
      const encryptionService = getSSOConfigEncryptionService();
      const decryptedConfig = await encryptionService.decryptSSOConfig(client.ssoConfig);
      const metadata = decryptedConfig.metadata as any;
      const frontendUrl = getFrontendUrl();
      const redirectUri = (metadata?.redirectUri as string) || `${frontendUrl}/api/auth/oidc/callback`;

      // Log redirect URI details for debugging
      logger.debug('OIDC authorization - redirect URI configuration', {
        clientId: req.clientId,
        redirectUri,
        frontendUrl,
        metadataRedirectUri: metadata?.redirectUri,
        protocol: req.get('x-forwarded-proto') || req.protocol,
        host: req.get('x-forwarded-host') || req.get('host'),
      });

      // Store state in Redis (configured TTL) - include codeVerifier for PKCE
      await stateService.storeState(state, req.clientId, nonce, redirectUri, config.sso.stateTtlSeconds, codeVerifier);

      // Generate authorization URL with PKCE code challenge
      const authUrl = await ssoService.generateAuthorizationUrl(
        oidcConfiguration,
        state,
        nonce,
        redirectUri,
        metadata?.scope || 'openid profile email',
        codeChallenge
      );

      logger.info('OIDC authorization initiated', { 
        clientId: req.clientId, 
        state,
        redirectUri,
        authUrl: authUrl.substring(0, SECURITY_CONSTANTS.MAX_URL_LOG_LENGTH), // Log first N chars of auth URL
      });

      // Redirect to identity provider
      res.redirect(authUrl);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'OIDC authorization failed';
      logger.error('OIDC authorization failed', { error: errorMessage, clientId: req.clientId });
      sendError(res, ERROR_CODES.OIDC_ERROR, errorMessage, 500);
    }
  }

  async oidcCallback(req: TenantRequest, res: Response): Promise<void> {
    // Helper function to get frontend URL from request (handles proxy/Cloudflare)
    const getFrontendUrl = (): string => {
      // Check for X-Forwarded-Proto and X-Forwarded-Host (Cloudflare/proxy)
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
      const host = req.get('x-forwarded-host') || req.get('host') || '';
      
      // If we have a host, use it
      if (host) {
        // Ensure protocol is https in production (Cloudflare always uses HTTPS)
        const finalProtocol = protocol === 'https' || config.nodeEnv === 'production' ? 'https' : protocol;
        return `${finalProtocol}://${host}`;
      }
      
      // Fallback to config
      return config.appUrl;
    };

    try {
      // Extract query parameters
      const { code, state, error, error_description } = req.query;

      // Handle provider errors
      if (error) {
        logger.error('OIDC provider returned error', { error, error_description, clientId: req.clientId });
        // Convert query parameters to strings
        const errorStr = Array.isArray(error_description) 
          ? error_description[0] 
          : (error_description as string | undefined);
        const errorCodeStr = Array.isArray(error) 
          ? error[0] 
          : (error as string | undefined);
        const errorMsg = (errorStr || errorCodeStr || 'OIDC authentication failed') as string;
        // Redirect to login page with error
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Authorization code and state are required', 400);
        return;
      }

      // Validate client ID
      if (!req.clientId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Client ID is required', 400);
        return;
      }

      // Get state service and validate state
      const stateService = getSSOStateService();
      const redisAvailable = await stateService.isAvailable();
      if (!redisAvailable) {
        logger.error('SSO State Service Redis is not available during callback', { 
          clientId: req.clientId,
          redisUrl: config.redisUrl ? 'configured' : 'not configured'
        });
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'SSO state service is not available. Redis connection required.', 500);
        return;
      }

      const stateData = await stateService.getState(state as string);
      if (!stateData) {
        logger.warn('Invalid or expired OIDC state', { state, clientId: req.clientId });
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Invalid or expired state parameter. Please try again.', 400);
        return;
      }

      // Verify client ID matches state
      if (stateData.clientId !== req.clientId) {
        logger.warn('Client ID mismatch in OIDC callback', { 
          stateClientId: stateData.clientId, 
          requestClientId: req.clientId 
        });
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Client ID mismatch', 400);
        return;
      }

      // Delete state (one-time use)
      await stateService.deleteState(state as string);

      // Get client and SSO configuration
      const client = await this.clientService.getClient(req.clientId);
      if (!client || !client.ssoConfig || !client.ssoConfig.enabled || client.ssoConfig.provider !== 'oidc') {
        sendError(res, ERROR_CODES.FORBIDDEN, 'SSO is not enabled or not configured for this client', 403);
        return;
      }

      // Get frontend URL for redirect URI and callback URL
      const frontendUrl = getFrontendUrl();

      // Get SSO service
      const ssoService = getSSOService();
      const oidcConfiguration = await ssoService.getOIDCConfiguration(client.ssoConfig);

      // Get redirect URI (decrypt first)
      const encryptionService = getSSOConfigEncryptionService();
      const decryptedConfig = await encryptionService.decryptSSOConfig(client.ssoConfig);
      const metadata = decryptedConfig.metadata as any;
      const redirectUri = stateData.redirectUri || metadata?.redirectUri || `${frontendUrl}/api/auth/oidc/callback`;

      // Build callback URL from request - use the actual request URL
      // This ensures the redirect URI matches what was sent to the provider
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
      const host = req.get('x-forwarded-host') || req.get('host') || '';
      const baseUrl = host ? `${protocol}://${host}` : frontendUrl;
      const callbackUrl = new URL(`${baseUrl}${req.originalUrl}`);
      
      // Extract just the base redirect URI (without query params) for comparison
      const callbackBaseUrl = `${callbackUrl.protocol}//${callbackUrl.host}${callbackUrl.pathname}`;
      const redirectUriBase = redirectUri.split('?')[0];
      
      logger.debug('Building callback URL for token exchange', {
        originalUrl: req.originalUrl,
        protocol,
        host,
        baseUrl,
        callbackUrl: callbackUrl.toString(),
        callbackBaseUrl,
        redirectUri,
        redirectUriBase,
        redirectUriMatch: callbackBaseUrl === redirectUriBase,
        queryParams: Object.keys(req.query),
        code: req.query.code ? 'present' : 'missing',
        state: req.query.state ? 'present' : 'missing',
      });

      // Warn if redirect URI doesn't match (this is a common cause of token exchange failures)
      if (callbackBaseUrl !== redirectUriBase) {
        logger.warn('Redirect URI mismatch detected', {
          callbackBaseUrl,
          redirectUriBase,
          clientId: req.clientId,
          note: 'This may cause token exchange to fail. Ensure redirect URI in OIDC provider matches exactly.',
        });
      }

      // Exchange authorization code for tokens using v6 API
      // authorizationCodeGrant expects a URL or Request object, not separate code/state
      const tokenSet = await ssoService.exchangeCodeForTokens(
        oidcConfiguration,
        callbackUrl,
        state as string,
        stateData.codeVerifier, // PKCE code verifier
        stateData.nonce
      );

      // Validate ID token (includes nonce validation)
      ssoService.validateIdToken(tokenSet, stateData.nonce);

      // Get user info from provider
      const userInfo = await ssoService.getUserInfo(oidcConfiguration, tokenSet);

      // Normalize user info
      const normalizedUserInfo = ssoService.normalizeUserInfo(userInfo);

      // Get default role ID for new users
      // If not configured, try to find or create a "Default" role as fallback
      let defaultRoleId = await this.clientService.getDefaultRoleId(req.clientId);
      if (!defaultRoleId) {
        logger.warn('Default role ID not found for client, attempting to create or find Default role', { clientId: req.clientId });
        try {
          defaultRoleId = await this.clientService.getOrCreateDefaultRole(req.clientId);
          logger.info('Successfully created or found Default role for client', { clientId: req.clientId, defaultRoleId });
        } catch (error: any) {
          logger.error('Failed to create or find Default role for client', { 
            clientId: req.clientId, 
            error: error.message 
          });
          sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Default role is not configured for this client and could not be created automatically. Please contact administrator.', 500);
          return;
        }
      }

      // Find or create user
      const user = await this.userService.findOrCreateSSOUser(
        normalizedUserInfo,
        req.clientId,
        defaultRoleId,
        req
      );

      // Check if user is active
      if (!user.isActive) {
        logger.warn('SSO login attempted for inactive user', { userId: user.id, email: user.email });
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Your account is inactive. Please contact administrator.')}`);
        return;
      }

      // Generate JWT tokens
      const tokens = await this.authService.generateTokens(user, req.clientId);
      await this.authService.saveRefreshToken(user.id, tokens.refreshToken, req);

      // Update last login timestamp after successful SSO login
      await this.authService.updateLastLogin(user.id, req);

      // Log audit event
      await this.auditService.log({
        userId: user.id,
        clientId: req.clientId,
        action: 'sso_login',
        resourceType: 'Auth',
        metadata: {
          provider: 'oidc',
          externalId: normalizedUserInfo.externalId,
          email: user.email,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      // Log security event
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.SSO_LOGIN,
        severity: 'low',
        message: 'SSO login successful',
        metadata: {
          userId: user.id,
          clientId: req.clientId,
          provider: 'oidc',
          email: user.email,
        },
        timestamp: new Date(),
      });

      logger.info('OIDC login successful', { userId: user.id, email: user.email, clientId: req.clientId });

      // Redirect to frontend with tokens
      // Option 1: Set tokens in HTTP-only cookies (recommended for production)
      // Option 2: Redirect with tokens in URL fragment (less secure)
      // Option 3: Use temporary code exchange (most secure)
      
      // For now, using URL fragment approach (can be improved later)
      const tokenParams = new URLSearchParams({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      // Redirect to frontend callback or dashboard
      res.redirect(`${frontendUrl}/auth/callback?${tokenParams.toString()}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'OIDC callback failed';
      logger.error('OIDC callback failed', { error: errorMessage, clientId: req.clientId });
      
      // Redirect to login with error
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('SSO authentication failed. Please try again.')}`);
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId!;
      const clientId = req.clientId!;

      if (!currentPassword || !newPassword) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Current password and new password are required', 400);
        return;
      }

      // Password complexity is validated by Joi schema, but double-check here
      const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordPattern.test(newPassword)) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)', 400);
        return;
      }

      // Verify current password - get user with passwordHash and source
      const userWithPassword = await AppDataSource.getRepository(User).findOne({
        where: { id: userId, clientId },
        select: ['id', 'passwordHash', 'source'],
      });

      if (!userWithPassword) {
        sendError(res, ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.NOT_FOUND('User'), 404);
        return;
      }

      // Prevent password reset for SSO users
      if (userWithPassword.source === 'sso') {
        sendError(res, ERROR_CODES.FORBIDDEN, 'Password reset is not available for SSO users. Please use SSO login.', 403);
        return;
      }

      const isValidPassword = await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
      if (!isValidPassword) {
        sendError(res, ERROR_CODES.FORBIDDEN, 'Current password is incorrect', 403);
        return;
      }

      // Reset password
      await this.userService.resetPassword(userId, clientId, newPassword, req);

      // Audit log
      await this.auditService.log({
        clientId,
        userId,
        action: 'user.password_reset',
        resourceType: 'User',
        resourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      sendSuccess(res, { message: SUCCESS_MESSAGES.PASSWORD_RESET });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      logger.error('Password reset failed', { error: errorMessage, userId: req.userId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 400);
    }
  }

  /**
   * Handle force password reset request (admin action)
   * Allows admins to reset a user's password without knowing the current password
   * @param req - Request containing email and newPassword
   * @param res - Response object
   * @throws Error if user is not found, is SSO user, or validation fails
   */
  async forceResetPassword(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { email, currentPassword, newPassword } = req.body;
      const clientId = req.clientId; // From subdomain middleware

      if (!email || !currentPassword || !newPassword) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Email, current password and new password are required', 400);
        return;
      }

      // Password complexity is validated by Joi schema, but double-check here
      const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordPattern.test(newPassword)) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)', 400);
        return;
      }

      if (!clientId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Client ID is required', 400);
        return;
      }

      // Find user by email and clientId, must have mustResetPassword = true
      const userWithPassword = await AppDataSource.getRepository(User).findOne({
        where: { email, clientId, isActive: true },
        select: ['id', 'email', 'passwordHash', 'mustResetPassword', 'clientId', 'source'],
      });

      if (!userWithPassword) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'User not found or inactive', 404);
        return;
      }

      // Prevent password reset for SSO users
      if (userWithPassword.source === 'sso') {
        sendError(res, ERROR_CODES.FORBIDDEN, 'Password reset is not available for SSO users. Please use SSO login.', 403);
        return;
      }

      // Verify user must reset password
      if (!userWithPassword.mustResetPassword) {
        sendError(res, ERROR_CODES.FORBIDDEN, 'Password reset is not required for this user', 403);
        return;
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
      if (!isValidPassword) {
        sendError(res, ERROR_CODES.FORBIDDEN, 'Current password is incorrect', 403);
        return;
      }

      // Reset password and clear mustResetPassword flag
      await this.userService.resetPassword(userWithPassword.id, clientId, newPassword, req);

      // Audit log
      await this.auditService.log({
        clientId,
        userId: userWithPassword.id,
        action: 'user.force_password_reset',
        resourceType: 'User',
        resourceId: userWithPassword.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      sendSuccess(res, { message: SUCCESS_MESSAGES.PASSWORD_RESET });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Force password reset failed';
      // Don't log email (PII) - secureLogger will redact it anyway, but better to not include it
      logger.error('Force password reset failed', { error: errorMessage });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 400);
    }
  }

  /**
   * Get current user's permissions
   * @param req - Authenticated request containing user ID and client ID
   * @param res - Response object
   * @returns Array of permission objects for the current user
   */
  async getMyPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const clientId = req.clientId;
      
      if (!clientId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Client ID is required', 400);
        return;
      }
      
      // All users (including super admin and developer) must have permissions checked
      const permissions = await this.permissionService.getUserPermissions(userId, clientId, req);
      sendSuccess(res, permissions);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get permissions';
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      logger.error('Failed to get permissions', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.GET_PERMISSIONS_ERROR, errorMessage, 500);
    }
  }

  /**
   * Get current user's information
   * @param req - Authenticated request containing user object
   * @param res - Response object
   * @returns User object with basic information (excluding sensitive data)
   */
  async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not found', 401);
        return;
      }

      sendSuccess(res, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        isDeveloper: user.isDeveloper,
        isActive: user.isActive,
        clientId: user.clientId,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get user info';
      logger.error('Failed to get user info', { error: errorMessage, userId: req.userId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }
}

