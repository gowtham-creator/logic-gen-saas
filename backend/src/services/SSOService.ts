import { Client as ClientEntity } from '../entities/Client';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import * as oidc from 'openid-client';
import type { Configuration } from 'openid-client';
import { getSSOConfigEncryptionService } from './SSOConfigEncryptionService';

// Type alias for OIDC Configuration
type OIDCConfiguration = Configuration;

interface OIDCTokenSet {
  access_token?: string;
  id_token?: string;
  claims(): Record<string, any>;
  expires_in?: number;
}

interface OIDCUserInfoResponse {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  display_name?: string;
  [key: string]: any;
}

export interface OIDCMetadata {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string; // Optional, defaults to 'openid profile email'
  clientAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none'; // Optional, defaults to 'client_secret_basic'
  logoutUrl?: string; // Optional logout URL override (if provider doesn't expose end_session_endpoint or requires custom URL)
  postLogoutRedirectUri?: string; // Optional post-logout redirect URI (if different from default login page)
}

export interface SSOUserInfo {
  email: string;
  firstName: string;
  lastName: string;
  externalId: string; // Subject (sub) from OIDC
  name?: string; // Full name if available
}

/**
 * Service for managing SSO operations (OIDC)
 */
export class SSOService {
  private configCache: Map<string, OIDCConfiguration> = new Map();

  constructor() {
    // Allow insecure requests (HTTP) in development mode only
    // This is needed for local OIDC providers or development environments
    if (config.nodeEnv === 'development') {
      logger.info('OIDC: Allowed insecure requests (HTTP) for development');
    }
  }

  /**
   * Get or create OIDC Configuration for a given client configuration
   * @param ssoConfig - SSO configuration from client entity
   * @returns OIDC Configuration instance
   */
  async getOIDCConfiguration(ssoConfig: ClientEntity['ssoConfig']): Promise<OIDCConfiguration> {
    if (!ssoConfig || !ssoConfig.enabled || ssoConfig.provider !== 'oidc') {
      throw new Error('OIDC is not enabled or not configured for this client');
    }

    // Decrypt SSO config before using
    const encryptionService = getSSOConfigEncryptionService();
    const decryptedConfig = await encryptionService.decryptSSOConfig(ssoConfig);
    
    const metadata = decryptedConfig.metadata as OIDCMetadata | undefined;
    if (!metadata) {
      throw new Error('OIDC metadata is missing');
    }

    // Validate required fields
    if (!metadata.issuer || !metadata.clientId || !metadata.clientSecret || !metadata.redirectUri) {
      throw new Error('OIDC metadata is incomplete. Required: issuer, clientId, clientSecret, redirectUri');
    }

    // Use cache key based on issuer and clientId
    const cacheKey = `${metadata.issuer}:${metadata.clientId}`;

    // Check cache first
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    try {
      // Convert issuer string to URL object (required by openid-client v6)
      let issuerUrl = new URL(metadata.issuer);
      
      // If issuer URL is HTTP, ensure it points to .well-known/openid-configuration
      // The discovery function expects the issuer base URL, but for HTTP we may need to be explicit
      if (issuerUrl.protocol === 'http:') {
        logger.debug('HTTP issuer URL detected', { issuerUrl: issuerUrl.toString() });
        // If the path doesn't already end with .well-known/openid-configuration, append it
        const wellKnownPath = '/.well-known/openid-configuration';
        if (!issuerUrl.pathname.endsWith(wellKnownPath)) {
          logger.debug('Appending .well-known/openid-configuration to HTTP issuer URL', { issuerUrl: issuerUrl.toString() });
          // Remove trailing slash if present, then append well-known path
          issuerUrl.pathname = issuerUrl.pathname.replace(/\/$/, '') + wellKnownPath;
          logger.debug('Appended .well-known/openid-configuration to HTTP issuer URL', { issuerUrl: issuerUrl.toString() });
        }
      }
      
      // Determine client authentication method
      // PingID/PingIdentity and Keycloak typically use client_secret_basic (Authorization header)
      // Some providers use client_secret_post (POST body)
      const authMethod = metadata.clientAuthMethod || 'client_secret_basic';
      
      let clientAuth: any;
      if (authMethod === 'client_secret_basic') {
        // Client ID and secret in Authorization header (Basic auth)
        // This is the standard method for PingID, Keycloak, and most OIDC providers
        clientAuth = oidc.ClientSecretBasic(metadata.clientSecret);
        logger.debug('Using ClientSecretBasic authentication method', { 
          issuer: metadata.issuer,
          clientId: metadata.clientId 
        });
      } else if (authMethod === 'client_secret_post') {
        // Client ID and secret in POST body
        clientAuth = oidc.ClientSecretPost(metadata.clientSecret);
        logger.debug('Using ClientSecretPost authentication method', { 
          issuer: metadata.issuer,
          clientId: metadata.clientId 
        });
      } else if (authMethod === 'none') {
        // Public client (no authentication)
        clientAuth = undefined;
        logger.debug('Using public client (no authentication)', { 
          issuer: metadata.issuer,
          clientId: metadata.clientId 
        });
      } else {
        throw new Error(`Unsupported client authentication method: ${authMethod}`);
      }
      
      // Client metadata
      const clientMetadata = {
        redirect_uris: [metadata.redirectUri],
        response_types: ['code'],
      };
      
      // Discover and create configuration
      // discovery(server: URL, clientId: string, metadata?: object, clientAuthentication?: object, options?: object)
      logger.debug('Discovering OIDC configuration', { issuerUrl: issuerUrl.toString(), clientMetadata: clientMetadata, clientAuth: clientAuth });
      const configuration = await oidc.discovery(
        issuerUrl,
        metadata.clientId,
        clientMetadata,
        clientAuth
      );
      
      logger.debug('Discovered OIDC issuer and created configuration', { issuer: metadata.issuer });

      // Cache the configuration
      this.configCache.set(cacheKey, configuration as OIDCConfiguration);

      return configuration as OIDCConfiguration;
    } catch (error: any) {
      logger.error('Failed to create OIDC configuration', { error: error.message, issuer: metadata.issuer });
      throw new Error(`Failed to initialize OIDC client: ${error.message}`);
    }
  }

  /**
   * Generate authorization URL for OIDC flow
   * @param configuration - OIDC Configuration instance
   * @param state - State parameter for CSRF protection
   * @param nonce - Nonce parameter for token validation
   * @param redirectUri - Redirect URI (optional, uses client default if not provided)
   * @param scope - Scope string (optional, defaults to 'openid profile email')
   * @param codeChallenge - PKCE code challenge (optional, if not provided PKCE won't be used)
   * @returns Authorization URL string
   */
  async generateAuthorizationUrl(
    configuration: OIDCConfiguration,
    state: string,
    nonce: string,
    redirectUri?: string,
    scope: string = 'openid profile email',
    codeChallenge?: string
  ): Promise<string> {
    try {
      // Get client metadata to find redirect URI
      const clientMetadata = configuration.clientMetadata();
      const redirectUris = clientMetadata.redirect_uris;
      let finalRedirectUri = redirectUri;
      
      if (!finalRedirectUri && Array.isArray(redirectUris) && redirectUris.length > 0) {
        const firstUri = redirectUris[0];
        finalRedirectUri = typeof firstUri === 'string' ? firstUri : undefined;
      }
      
      if (!finalRedirectUri) {
        throw new Error('Redirect URI is required');
      }

      // Build authorization URL parameters
      const params: Record<string, string> = {
        redirect_uri: finalRedirectUri,
        scope,
        state,
        nonce,
      };

      // Add PKCE if code challenge is provided
      if (codeChallenge) {
        params.code_challenge = codeChallenge;
        params.code_challenge_method = 'S256';
      }

      // Build authorization URL using v6 API
      const authUrl = oidc.buildAuthorizationUrl(configuration, params);
      
      return authUrl.toString();
    } catch (error: any) {
      logger.error('Failed to generate authorization URL', { error: error.message });
      throw new Error(`Failed to generate authorization URL: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param configuration - OIDC Configuration instance
   * @param callbackUrl - Full callback URL with query parameters from OIDC provider
   * @param expectedState - Expected state parameter (for validation)
   * @param codeVerifier - PKCE code verifier (if PKCE was used)
   * @param expectedNonce - Expected nonce parameter (for validation)
   * @returns Token set
   */
  async exchangeCodeForTokens(
    configuration: OIDCConfiguration,
    callbackUrl: URL | Request,
    expectedState: string,
    codeVerifier?: string,
    expectedNonce?: string
  ): Promise<OIDCTokenSet> {
    try {
      // Log callback URL for debugging
      const urlString = callbackUrl instanceof URL ? callbackUrl.toString() : (callbackUrl as any).url || 'Request object';
      logger.debug('Exchanging code for tokens', { 
        callbackUrl: urlString,
        hasCodeVerifier: !!codeVerifier,
        hasNonce: !!expectedNonce 
      });

      // Build checks object for authorizationCodeGrant
      const checks: any = {
        expectedState,
      };
      
      if (codeVerifier) {
        checks.pkceCodeVerifier = codeVerifier;
      }
      
      if (expectedNonce) {
        checks.expectedNonce = expectedNonce;
      }

      // Use authorizationCodeGrant to exchange code for tokens
      const tokenSet = await oidc.authorizationCodeGrant(configuration, callbackUrl, checks);
      
      logger.debug('Exchanged authorization code for tokens successfully');

      return tokenSet as OIDCTokenSet;
    } catch (error: any) {
      // Extract detailed error information from oauth4webapi ResponseBodyError
      let errorDetails: any = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };

      // Extract OAuth error fields directly from error object (oauth4webapi puts them here)
      if (error.error) {
        errorDetails.oauthError = error.error;
      }
      if (error.error_description) {
        errorDetails.oauthErrorDescription = error.error_description;
      }
      if (error.error_uri) {
        errorDetails.oauthErrorUri = error.error_uri;
      }
      if (error.code) {
        errorDetails.oauthErrorCode = error.code;
      }

      // Try to extract response body details if available
      if (error.response) {
        errorDetails.response = {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
        };
      }

      // Also check status directly on error object
      if (error.status) {
        errorDetails.status = error.status;
      }

      // Try to extract response body if available (oauth4webapi may include this)
      if (error.body) {
        errorDetails.responseBody = typeof error.body === 'string' 
          ? error.body 
          : JSON.stringify(error.body);
      }

      // Check for OAuth error response format in nested response object (fallback)
      if (error.response && typeof error.response === 'object') {
        if (error.response.error && !errorDetails.oauthError) {
          errorDetails.oauthError = error.response.error;
        }
        if (error.response.error_description && !errorDetails.oauthErrorDescription) {
          errorDetails.oauthErrorDescription = error.response.error_description;
        }
        if (error.response.error_uri && !errorDetails.oauthErrorUri) {
          errorDetails.oauthErrorUri = error.response.error_uri;
        }
      }

      // Log comprehensive error details
      logger.error('Failed to exchange code for tokens', { 
        ...errorDetails,
        callbackUrl: callbackUrl instanceof URL ? callbackUrl.toString() : 'Request object',
        hasCodeVerifier: !!codeVerifier,
        hasNonce: !!expectedNonce,
        // Include all error properties for debugging
        errorProperties: Object.keys(error),
        // Log raw error object for deep debugging (in development)
        rawError: config.nodeEnv === 'development' ? {
          error: error.error,
          error_description: error.error_description,
          status: error.status,
          code: error.code,
        } : undefined,
      });

      // Construct a more descriptive error message
      let errorMessage = error.message || 'Unknown error';
      
      // Prioritize OAuth error details
      if (errorDetails.oauthError) {
        errorMessage = `OAuth error: ${errorDetails.oauthError}`;
        if (errorDetails.oauthErrorDescription) {
          errorMessage += ` - ${errorDetails.oauthErrorDescription}`;
        }
      } else if (errorDetails.status === 401) {
        // 401 Unauthorized typically means authentication failure
        errorMessage = 'Token exchange failed: Authentication failed (401 Unauthorized). This usually indicates: invalid client credentials, redirect URI mismatch, or invalid authorization code.';
        if (errorDetails.oauthErrorDescription) {
          errorMessage += ` Details: ${errorDetails.oauthErrorDescription}`;
        }
      } else if (errorDetails.responseBody) {
        errorMessage = `Token exchange failed: ${errorDetails.responseBody}`;
      } else if (errorDetails.status) {
        errorMessage = `Token exchange failed: HTTP ${errorDetails.status} ${errorDetails.response?.statusText || ''}`.trim();
      }

      throw new Error(`Token exchange failed: ${errorMessage}`);
    }
  }

  /**
   * Get user info from ID token or userinfo endpoint
   * @param configuration - OIDC Configuration instance
   * @param tokenSet - Token set from token exchange
   * @returns User info
   */
  async getUserInfo(configuration: OIDCConfiguration, tokenSet: OIDCTokenSet): Promise<OIDCUserInfoResponse> {
    try {
      // First, try to get user info from userinfo endpoint
      if (tokenSet.access_token) {
        // Get subject from ID token claims if available
        let expectedSubject: string | undefined;
        if (tokenSet.id_token) {
          const claims = tokenSet.claims();
          expectedSubject = claims?.sub as string | undefined;
        }
        
        // Use skipSubjectCheck if we don't have a subject
        const subject = expectedSubject || oidc.skipSubjectCheck;
        const userInfo = await oidc.fetchUserInfo(configuration, tokenSet.access_token, subject);
        return userInfo as OIDCUserInfoResponse;
      }

      // If no access token, try to extract from ID token claims
      if (tokenSet.id_token) {
        const claims = tokenSet.claims();
        return claims as OIDCUserInfoResponse;
      }

      throw new Error('No access token or ID token available');
    } catch (error: any) {
      logger.error('Failed to get user info', { error: error.message });
      throw new Error(`Failed to retrieve user info: ${error.message}`);
    }
  }

  /**
   * Normalize user info from OIDC provider to our format
   * @param userInfo - User info from OIDC provider
   * @returns Normalized user info
   */
  normalizeUserInfo(userInfo: OIDCUserInfoResponse): SSOUserInfo {
    // Extract email (required)
    const email = (userInfo.email as string) || (userInfo.preferred_username as string) || (userInfo.sub as string);
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required but not provided by identity provider');
    }

    // Extract external ID (subject)
    const externalId = userInfo.sub as string;
    if (!externalId || typeof externalId !== 'string') {
      throw new Error('Subject (sub) is required but not provided by identity provider');
    }

    // Extract name
    const fullName = ((userInfo.name as string) || (userInfo.display_name as string) || '').trim();
    let firstName = ((userInfo.given_name as string) || '').trim();
    let lastName = ((userInfo.family_name as string) || '').trim();

    // If we have full name but not first/last, try to parse
    if (fullName && !firstName && !lastName) {
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length > 0) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ') || '';
      }
    }

    // Fallback: use email prefix as firstName if no name provided
    if (!firstName && !lastName) {
      const emailPrefix = email.split('@')[0];
      firstName = emailPrefix;
      lastName = '';
    }

    return {
      email: email.toLowerCase().trim(),
      firstName: firstName.trim() || 'User',
      lastName: lastName.trim() || '',
      externalId,
      name: fullName || undefined,
    };
  }

  /**
   * Validate ID token (signature, issuer, audience, expiration)
   * This is done automatically by openid-client v6 in authorizationCodeGrant, 
   * but we can add custom validation here if needed
   * @param tokenSet - Token set containing ID token
   * @param nonce - Nonce value to validate
   */
  validateIdToken(tokenSet: OIDCTokenSet, nonce: string): void {
    try {
      // openid-client v6 automatically validates in authorizationCodeGrant:
      // - Signature
      // - Issuer (iss)
      // - Audience (aud)
      // - Expiration (exp)
      // - Nonce (if provided in checks)

      const claims = tokenSet.claims();

      // Additional validation: check nonce
      if (claims && claims.nonce !== nonce) {
        throw new Error('Nonce mismatch - possible replay attack');
      }

      logger.debug('ID token validated successfully', { sub: claims?.sub });
    } catch (error: any) {
      logger.error('ID token validation failed', { error: error.message });
      throw new Error(`ID token validation failed: ${error.message}`);
    }
  }
  
  /**
   * Generate PKCE code verifier and challenge
   * @returns Object with code_verifier and code_challenge
   */
  async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate logout URL for OIDC provider
   * Uses the end_session_endpoint from the OIDC provider's discovery document
   * @param configuration - OIDC Configuration instance
   * @param idToken - ID token from the user's session (optional, but recommended)
   * @param postLogoutRedirectUri - URI to redirect to after logout (optional)
   * @returns Logout URL string
   */
  async generateLogoutUrl(
    configuration: OIDCConfiguration,
    idToken?: string,
    postLogoutRedirectUri?: string,
    metadata?: OIDCMetadata
  ): Promise<string | null> {
    try {
      // First, check if a custom logout URL is configured in metadata (override)
      if (metadata?.logoutUrl) {
        logger.debug('Using custom logout URL from metadata', { logoutUrl: metadata.logoutUrl });
        
        // Build logout URL with parameters
        const logoutUrl = new URL(metadata.logoutUrl);
        
        // Add ID token hint if available
        if (idToken) {
          logoutUrl.searchParams.append('id_token_hint', idToken);
        }
        
        // Use configured postLogoutRedirectUri or provided one
        const finalPostLogoutUri = metadata.postLogoutRedirectUri || postLogoutRedirectUri;
        if (finalPostLogoutUri) {
          logoutUrl.searchParams.append('post_logout_redirect_uri', finalPostLogoutUri);
        }
        
        return logoutUrl.toString();
      }

      // Otherwise, try to get end_session_endpoint from discovery document
      // Access issuer metadata from configuration
      // The configuration object from openid-client contains issuer metadata
      // We need to access it through the configuration's internal structure
      const configAny = configuration as any;
      
      // Try different ways to access issuer metadata
      let issuerMetadata: any = null;
      if (typeof configAny.issuerMetadata === 'function') {
        issuerMetadata = configAny.issuerMetadata();
      } else if (configAny.issuer_metadata) {
        issuerMetadata = configAny.issuer_metadata;
      } else if (configAny.issuerMetadata) {
        issuerMetadata = configAny.issuerMetadata;
      }
      
      // Check if end_session_endpoint is available
      const endSessionEndpoint = issuerMetadata?.end_session_endpoint;
      if (!endSessionEndpoint) {
        logger.debug('OIDC provider does not support end_session_endpoint and no custom logout URL configured', {
          hasMetadata: !!issuerMetadata,
          issuer: issuerMetadata?.issuer || 'unknown',
          hasCustomLogoutUrl: !!metadata?.logoutUrl
        });
        return null;
      }

      // Build logout URL parameters
      const params: Record<string, string> = {};
      
      // Add ID token hint if available (helps provider identify the session)
      if (idToken) {
        params.id_token_hint = idToken;
      }
      
      // Add post logout redirect URI if provided
      if (postLogoutRedirectUri) {
        params.post_logout_redirect_uri = postLogoutRedirectUri;
      }

      // Build the logout URL
      const logoutUrl = new URL(endSessionEndpoint);
      Object.entries(params).forEach(([key, value]) => {
        logoutUrl.searchParams.append(key, value);
      });

      logger.debug('Generated OIDC logout URL', {
        endSessionEndpoint,
        hasIdToken: !!idToken,
        postLogoutRedirectUri
      });

      return logoutUrl.toString();
    } catch (error: any) {
      logger.error('Failed to generate logout URL', { error: error.message });
      return null;
    }
  }
}

// Singleton instance
let ssoServiceInstance: SSOService | null = null;

export function getSSOService(): SSOService {
  if (!ssoServiceInstance) {
    ssoServiceInstance = new SSOService();
  }
  return ssoServiceInstance;
}

