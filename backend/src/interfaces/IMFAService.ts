import { TenantRequest } from '../types/middleware.types';
import { MFASetupResult, MFAVerificationResult } from '../services/MFAService';

/**
 * Multi-Factor Authentication (MFA) service interface
 * Handles TOTP-based MFA setup, verification, and management
 */
export interface IMFAService {
  /**
   * Check if MFA is enforced for a client (all users must enable MFA)
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if MFA is enforced for the client
   */
  isMFAEnforced(clientId: string, req?: TenantRequest): Promise<boolean>;

  /**
   * Check if MFA is required for a client (MFA must be used if enabled)
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if MFA is required for the client
   */
  isMFARequired(clientId: string, req?: TenantRequest): Promise<boolean>;

  /**
   * Check if MFA is enabled and verified for a user
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if MFA is both enabled and verified for the user
   */
  isMFAEnabled(userId: string, clientId: string, req?: TenantRequest): Promise<boolean>;

  /**
   * Check if a user has initiated MFA setup (has secret generated)
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if user has started MFA setup process
   */
  hasMFASetup(userId: string, clientId: string, req?: TenantRequest): Promise<boolean>;

  /**
   * Initialize MFA setup for a user (generates secret and QR code)
   * Note: Does not save to database until verification is complete
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns Secret, QR code URL, and backup codes (not saved to DB yet)
   */
  setupMFA(userId: string, clientId: string, req?: TenantRequest): Promise<MFASetupResult>;

  /**
   * Verify TOTP token and enable MFA for a user
   * Only saves encrypted secret and backup codes after successful verification
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param token - The 6-digit TOTP token or backup code
   * @param secret - The plain text secret from setup step
   * @param backupCodes - The plain text backup codes from setup step
   * @param req - Optional tenant request context
   * @returns Verification result with validity and backup code usage flag
   * @throws Error if token is invalid or user is not found
   */
  verifyAndEnableMFA(userId: string, clientId: string, token: string, secret: string, backupCodes: string[], req?: TenantRequest): Promise<MFAVerificationResult>;

  /**
   * Verify MFA token during login
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param token - The 6-digit TOTP token or backup code
   * @param req - Optional tenant request context
   * @returns Verification result with validity and backup code usage flag
   * @throws Error if token is invalid, MFA is not enabled, or user is not found
   */
  verifyMFA(userId: string, clientId: string, token: string, req?: TenantRequest): Promise<MFAVerificationResult>;

  /**
   * Disable MFA for a user (removes secret and backup codes)
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @throws Error if user is not found or MFA is enforced
   */
  disableMFA(userId: string, clientId: string, req?: TenantRequest): Promise<void>;

  /**
   * Reset MFA for a user (admin action - clears all MFA data)
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @throws Error if user is not found
   */
  resetMFA(userId: string, clientId: string, req?: TenantRequest): Promise<void>;

  /**
   * Get remaining backup codes for a user
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns Array of remaining backup codes (decrypted)
   * @throws Error if user is not found or MFA is not enabled
   */
  getBackupCodes(userId: string, clientId: string, req?: TenantRequest): Promise<string[]>;

  /**
   * Regenerate backup codes for a user
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns Array of new backup codes (encrypted and saved to DB)
   * @throws Error if user is not found or MFA is not enabled
   */
  regenerateBackupCodes(userId: string, clientId: string, req?: TenantRequest): Promise<string[]>;
}

