import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { TOTPService, TOTPSecret } from './TOTPService';
import { getTenantRepository } from '../utils/tenantRepository';
import { TenantRequest } from '../types/middleware.types';
import { getIsolationLevel } from '../utils/isolationHelper';
import { IMFAService } from '../interfaces/IMFAService';
import { MFA_CONSTANTS } from '../constants/mfa';

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerificationResult {
  valid: boolean;
  usedBackupCode?: boolean;
}

/**
 * Multi-Factor Authentication (MFA) service implementation
 * Handles TOTP-based MFA setup, verification, and management
 */
export class MFAService implements IMFAService {
  private totpService: TOTPService;

  constructor() {
    this.totpService = new TOTPService();
  }

  private getUserRepository(req?: TenantRequest): Repository<User> {
    if (req) {
      return getTenantRepository(req, User);
    }
    return AppDataSource.getRepository(User);
  }

  private getClientRepository(): Repository<Client> {
    return AppDataSource.getRepository(Client);
  }

  /**
   * Check if MFA is enforced for a client (all users must enable MFA)
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if MFA is enforced for the client
   */
  async isMFAEnforced(clientId: string, req?: TenantRequest): Promise<boolean> {
    const client = await this.getClientRepository().findOne({
      where: { id: clientId, deletedAt: IsNull() },
    });
    return client?.enforceMFA || false;
  }

  /**
   * Check if MFA is required for a client (MFA must be used if enabled)
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if MFA is required for the client
   */
  async isMFARequired(clientId: string, req?: TenantRequest): Promise<boolean> {
    const client = await this.getClientRepository().findOne({
      where: { id: clientId, deletedAt: IsNull() },
    });
    return client?.mfaRequired || false;
  }

  /**
   * Check if MFA is enabled and verified for a user
   * MFA is considered enabled only if both mfaEnabled and mfaVerified are true
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if MFA is both enabled and verified for the user
   */
  async isMFAEnabled(userId: string, clientId: string, req?: TenantRequest): Promise<boolean> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    const where: any = { id: userId, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const user = await repository.findOne({ where });
    // MFA is only truly enabled if both flags are true
    return (user?.mfaEnabled && user?.mfaVerified) || false;
  }

  /**
   * Check if a user has initiated MFA setup (has secret generated)
   * This is used to distinguish between setup and verification flows
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns True if user has started MFA setup process (has totpSecret)
   */
  async hasMFASetup(userId: string, clientId: string, req?: TenantRequest): Promise<boolean> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    // Use query builder to explicitly select totpSecret (it has select: false)
    const queryBuilder = repository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .andWhere('user.deletedAt IS NULL')
      .addSelect('user.totpSecret');
    
    if (isolationLevel !== 'database' && clientId) {
      queryBuilder.andWhere('user.clientId = :clientId', { clientId });
    }

    const user = await queryBuilder.getOne();
    // User has MFA setup if they have a totpSecret
    return !!user?.totpSecret;
  }

  /**
   * Initialize MFA setup for a user (generates secret and QR code)
   * Note: Does not save to database until verification is complete
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns Secret, QR code URL, and backup codes (not saved to DB yet)
   * @throws Error if user is not found or MFA is already enabled
   */
  async setupMFA(userId: string, clientId: string, req?: TenantRequest): Promise<MFASetupResult> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    // Use query builder to check if MFA is already enabled
    const queryBuilder = repository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .andWhere('user.deletedAt IS NULL');
    
    if (isolationLevel !== 'database' && clientId) {
      queryBuilder.andWhere('user.clientId = :clientId', { clientId });
    }
    
    const user = await queryBuilder.getOne();
    
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent MFA setup for SSO users (MFA is managed by SSO provider)
    if (user.source === 'sso') {
      throw new Error('MFA setup is not available for SSO users. MFA is managed by the SSO provider.');
    }

    if (user.mfaEnabled) {
      throw new Error('MFA is already enabled for this user');
    }

    // Generate TOTP secret
    const totpData = await this.totpService.generateSecret(user.email, `${user.firstName} ${user.lastName}`);

    // Do NOT store secret in database yet - only return it for user to scan
    // Secret will be stored only after successful verification in verifyAndEnableMFA

    return {
      secret: totpData.secret, // Return plain secret for one-time display
      qrCodeUrl: totpData.qrCodeUrl,
      backupCodes: totpData.backupCodes,
    };
  }

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
  async verifyAndEnableMFA(
    userId: string,
    clientId: string,
    token: string,
    secret: string,
    backupCodes: string[],
    req?: TenantRequest
  ): Promise<MFAVerificationResult> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    const where: any = { id: userId, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const user = await repository.findOne({ where });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent MFA verification/enable for SSO users
    if (user.source === 'sso') {
      throw new Error('MFA setup is not available for SSO users. MFA is managed by the SSO provider.');
    }

    if (user.mfaEnabled && user.mfaVerified) {
      throw new Error('MFA is already enabled and verified');
    }

    // Verify token against the plain secret (not stored yet)
    const totpResult = this.totpService.verifyTokenPlain(secret, token);
    
    if (totpResult.valid) {
      // Only now store the encrypted secret and backup codes after successful verification
      const encryptedSecret = this.totpService.encryptSecret(secret);
      const encryptedBackupCodes = this.totpService.encryptBackupCodes(backupCodes);
      
      user.totpSecret = encryptedSecret;
      user.mfaBackupCodes = encryptedBackupCodes;
      user.mfaEnabled = true;
      user.mfaVerified = true;
      await repository.save(user);
      return { valid: true, usedBackupCode: false };
    }

    // If TOTP failed, try backup code
    const backupResult = this.totpService.verifyBackupCodePlain(backupCodes, token);
    
    if (backupResult.valid) {
      // Only now store the encrypted secret and backup codes after successful verification
      const encryptedSecret = this.totpService.encryptSecret(secret);
      const encryptedBackupCodes = this.totpService.encryptBackupCodes(backupResult.remainingCodes);
      
      user.totpSecret = encryptedSecret;
      user.mfaBackupCodes = encryptedBackupCodes;
      user.mfaEnabled = true;
      user.mfaVerified = true;
      await repository.save(user);
      return { valid: true, usedBackupCode: true };
    }

    return { valid: false };
  }

  /**
   * Verify MFA token during login
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param token - The 6-digit TOTP token or backup code
   * @param req - Optional tenant request context
   * @returns Verification result with validity and backup code usage flag
   * @throws Error if token is invalid, MFA is not enabled, or user is not found
   */
  async verifyMFA(
    userId: string,
    clientId: string,
    token: string,
    req?: TenantRequest
  ): Promise<MFAVerificationResult> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    const where: any = { id: userId, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    // Use query builder to explicitly select totpSecret and mfaBackupCodes (they have select: false)
    const queryBuilder = repository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .andWhere('user.deletedAt IS NULL');
    
    if (isolationLevel !== 'database' && clientId) {
      queryBuilder.andWhere('user.clientId = :clientId', { clientId });
    }
    
    // Explicitly select fields that are excluded by default
    queryBuilder.addSelect('user.totpSecret');
    queryBuilder.addSelect('user.mfaBackupCodes');
    
    const user = await queryBuilder.getOne();
    
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent MFA verification for SSO users
    if (user.source === 'sso') {
      throw new Error('MFA verification is not available for SSO users. MFA is managed by the SSO provider.');
    }

    if (!user.mfaEnabled || !user.mfaVerified) {
      throw new Error('MFA is not enabled for this user');
    }

    if (!user.totpSecret) {
      throw new Error('MFA secret not found');
    }

    // Try TOTP token first
    const totpResult = this.totpService.verifyToken(user.totpSecret, token);
    
    if (totpResult.valid) {
      return { valid: true, usedBackupCode: false };
    }

    // If TOTP failed, try backup code
    if (user.mfaBackupCodes) {
      const backupResult = this.totpService.verifyBackupCode(user.mfaBackupCodes, token);
      
      if (backupResult.valid) {
        // Update backup codes (remove used one)
        user.mfaBackupCodes = this.totpService.encryptBackupCodes(backupResult.remainingCodes);
        await repository.save(user);
        return { valid: true, usedBackupCode: true };
      }
    }

    return { valid: false };
  }

  /**
   * Disable MFA for a user (removes secret and backup codes)
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @throws Error if user is not found or MFA is enforced
   */
  async disableMFA(userId: string, clientId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    const where: any = { id: userId, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const user = await repository.findOne({ where });
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent MFA disable for SSO users
    if (user.source === 'sso') {
      throw new Error('MFA management is not available for SSO users. MFA is managed by the SSO provider.');
    }

    // Check if MFA is enforced
    const mfaEnforced = await this.isMFAEnforced(clientId);
    if (mfaEnforced) {
      throw new Error('MFA is enforced by your organization and cannot be disabled');
    }

    user.mfaEnabled = false;
    user.mfaVerified = false;
    user.totpSecret = undefined;
    user.mfaBackupCodes = undefined;

    await repository.save(user);
  }

  /**
   * Reset MFA for a user (admin action - clears all MFA data)
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @throws Error if user is not found
   */
  async resetMFA(userId: string, clientId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    // First verify user exists
    const where: any = { id: userId, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const user = await repository.findOne({ where });
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent MFA reset for SSO users
    if (user.source === 'sso') {
      throw new Error('MFA management is not available for SSO users. MFA is managed by the SSO provider.');
    }

    // Use query builder with raw SQL expressions to explicitly clear fields with select: false
    // This ensures totpSecret and mfaBackupCodes are properly set to NULL in the database
    const queryBuilder = repository
      .createQueryBuilder()
      .update(User)
      .set({
        mfaEnabled: false,
        mfaVerified: false,
        totpSecret: () => 'NULL', // Raw SQL to set to NULL
        mfaBackupCodes: () => 'NULL', // Raw SQL to set to NULL
      } as any)
      .where('id = :userId', { userId })
      .andWhere('deletedAt IS NULL');
    
    if (isolationLevel !== 'database' && clientId) {
      queryBuilder.andWhere('clientId = :clientId', { clientId });
    }

    const result = await queryBuilder.execute();
    
    if (result.affected === 0) {
      throw new Error('Failed to reset MFA - user not found or no changes made');
    }
  }

  /**
   * Get remaining backup codes for a user
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns Array of remaining backup codes (decrypted)
   * @throws Error if user is not found or MFA is not enabled
   */
  async getBackupCodes(userId: string, clientId: string, req?: TenantRequest): Promise<string[]> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    const where: any = { id: userId, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const user = await repository.findOne({ where });
    if (!user || !user.mfaBackupCodes) {
      return [];
    }

    return this.totpService.decryptBackupCodes(user.mfaBackupCodes);
  }

  /**
   * Regenerate backup codes for a user
   */
  async regenerateBackupCodes(userId: string, clientId: string, req?: TenantRequest): Promise<string[]> {
    const repository = this.getUserRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    const where: any = { id: userId, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const user = await repository.findOne({ where });
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.mfaEnabled) {
      throw new Error('MFA is not enabled for this user');
    }

    // Generate new backup codes
    const codes: string[] = [];
    for (let i = 0; i < MFA_CONSTANTS.BACKUP_CODES_COUNT; i++) {
      const code = Math.random().toString(36).substring(2, 2 + MFA_CONSTANTS.BACKUP_CODE_LENGTH).toUpperCase();
      codes.push(code);
    }

    const encryptedCodes = this.totpService.encryptBackupCodes(codes);
    user.mfaBackupCodes = encryptedCodes;
    await repository.save(user);

    return codes;
  }
}

