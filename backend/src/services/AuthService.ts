import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Repository, DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { config } from '../config/config';
import { JWTPayload, TenantRequest } from '../types/middleware.types';
import { LoginDto, AuthTokens } from '../types/auth.types';
import { getTenantRepository, getTenantDataSource } from '../utils/tenantRepository';
import { IAuthService } from '../interfaces/IAuthService';
import { IMFAService } from '../interfaces/IMFAService';
import { TokenBlacklistService } from './TokenBlacklistService';
import { getSecurityMonitoringService, SecurityEventType } from './SecurityMonitoringService';
import { SECURITY_CONSTANTS } from '../constants/security';
import { AUTH_CONSTANTS } from '../constants/auth';
import { DeviceService } from './DeviceService';
import { getEmailService } from './EmailService';
import { Request } from 'express';
import { ClientDeviceInfo } from '../utils/deviceFingerprint';
import { logger } from '../utils/logger';

/**
 * Authentication service implementation
 * Handles user authentication, token management, and password operations
 */
export class AuthService implements IAuthService {
  private blacklistService: TokenBlacklistService;
  private deviceService: DeviceService;

  /**
   * @param mfaService - Optional MFA service for multi-factor authentication checks
   */
  constructor(private mfaService?: IMFAService) {
    this.blacklistService = new TokenBlacklistService();
    this.deviceService = new DeviceService();
  }
  
  private getRepository(req?: TenantRequest): Repository<User> {
    if (req) {
      return getTenantRepository(req, User);
    }
    return AppDataSource.getRepository(User);
  }

  private getDataSource(req?: TenantRequest): DataSource {
    if (req) {
      return getTenantDataSource(req);
    }
    return AppDataSource;
  }

  /**
   * Authenticate a user with email and password
   * @param data - Login credentials (email and password)
   * @param req - Optional tenant request context
   * @returns User object, auth tokens, and optional flags for password reset or MFA requirements
   * @throws Error if credentials are invalid, user is not found, or user is SSO-only
   */
  async login(data: LoginDto, req?: TenantRequest): Promise<{ user: User; tokens: AuthTokens; mustResetPassword?: boolean; requiresMFA?: boolean; requiresMFASetup?: boolean }> {
    const repository = this.getRepository(req);
    const dataSource = this.getDataSource(req);

    // For database-per-tenant, clientId is not needed (all users in that DB belong to that tenant)
    // For shared, clientId is required
    let isolationLevel: string | undefined;
    let actualRepository = repository;

    // Always get isolation level if we have clientId and tenantDataSource
    if (req?.tenantDataSource && data.clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(data.clientId);

      isolationLevel = config.isolationLevel;
    } else {
      // Default to shared if we don't have tenantDataSource
      isolationLevel = 'shared';
    }

    try {
      // Build where clause based on isolation level
      const where: any = {
        email: data.email,
        isActive: true,
      };

      // Only include clientId for shared and schema-per-tenant
      if (isolationLevel !== 'database' && data.clientId) {
        where.clientId = data.clientId;
      }

      // For database-per-tenant, don't try to load client relation (it doesn't exist in tenant DB)
      // Use query builder to avoid TypeORM trying to auto-select nested relations
      const queryBuilder = actualRepository
        .createQueryBuilder('user')
        .where('user.email = :email', { email: where.email })
        .andWhere('user.isActive = :isActive', { isActive: true });

      if (where.clientId) {
        queryBuilder.andWhere('user.clientId = :clientId', { clientId: where.clientId });
      }

      queryBuilder
        .addSelect('user.id')
        .addSelect('user.email')
        .addSelect('user.passwordHash')
        .addSelect('user.firstName')
        .addSelect('user.lastName')
        .addSelect('user.clientId')
        .addSelect('user.roleId')
        .addSelect('user.isActive')
        .addSelect('user.mustResetPassword')
        .addSelect('user.source')
        .addSelect('user.externalId')
        .addSelect('user.isSuperAdmin')
        .addSelect('user.isDeveloper')
        .addSelect('user.createdAt')
        .addSelect('user.failedLoginAttempts')
        .addSelect('user.accountLockedUntil')
        .addSelect('user.updatedAt');

      if (isolationLevel !== 'database') {
        queryBuilder.leftJoinAndSelect('user.client', 'client');
      }

      // Explicitly select only essential role columns (excluding optional columns that may not exist)
      queryBuilder
        .leftJoin('user.role', 'role')
        .addSelect([
          'role.id',
          'role.name',
          'role.description',
          'role.clientId',
          'role.createdAt',
          'role.updatedAt'
        ]);

      const user = await queryBuilder.getOne();
      console.log('user', user);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Prevent direct login for SSO users
      if (user.source === 'sso') {
        throw new Error('This account uses SSO authentication. Please use SSO login.');
      }

      // Check if account is locked
      if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        const minutesRemaining = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 60000);
        throw new Error(`Account is locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute(s).`);
      }

      // Reset lockout if it has expired
      if (user.accountLockedUntil && user.accountLockedUntil <= new Date()) {
        await actualRepository.update(
          { id: user.id },
          { failedLoginAttempts: 0, accountLockedUntil: undefined }
        );
        user.failedLoginAttempts = 0;
        user.accountLockedUntil = undefined;
      }

      const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!isValidPassword) {
        // Increment failed login attempts
        const failedAttempts = (user.failedLoginAttempts || 0) + 1;

        if (failedAttempts >= SECURITY_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS) {
          // Lock account
          const lockoutUntil = new Date();
          lockoutUntil.setMinutes(lockoutUntil.getMinutes() + SECURITY_CONSTANTS.ACCOUNT_LOCKOUT_MINUTES);
          
          await actualRepository.update(
            { id: user.id },
            { 
              failedLoginAttempts: failedAttempts,
              accountLockedUntil: lockoutUntil
            }
          );

          // Blacklist all existing tokens for this user when account is locked
          // This invalidates all active sessions for security
          await this.blacklistService.blacklistUserTokens(user.id);

          // Log account lockout event
          const securityMonitoring = getSecurityMonitoringService();
          securityMonitoring.log({
            type: SecurityEventType.ACCOUNT_LOCKED,
            severity: 'high',
            message: `Account locked due to ${SECURITY_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS} failed login attempts`,
            metadata: {
              userId: user.id,
              email: data.email, // Will be sanitized
              clientId: data.clientId,
              subdomain: req?.tenant?.subdomain || undefined,
              failedAttempts: failedAttempts,
              lockoutDuration: SECURITY_CONSTANTS.ACCOUNT_LOCKOUT_MINUTES,
            },
            timestamp: new Date(),
          });
          
          throw new Error(`Account locked due to ${SECURITY_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS} failed login attempts. Please try again in ${SECURITY_CONSTANTS.ACCOUNT_LOCKOUT_MINUTES} minutes.`);
        } else {
          // Just increment failed attempts
          await actualRepository.update(
            { id: user.id },
            { failedLoginAttempts: failedAttempts }
          );
        }
        throw new Error('Invalid credentials');
      }

      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0 || user.accountLockedUntil) {
        await actualRepository.update(
          { id: user.id },
          { failedLoginAttempts: 0, accountLockedUntil: undefined }
        );
      }

      // If user must reset password, return early without tokens
      if (user.mustResetPassword) {
        return { user, tokens: {} as AuthTokens, mustResetPassword: true };
      }

      // Check if MFA is required for all users
      // Use injected MFA service if available, otherwise import dynamically
      let mfaService: IMFAService;
      if (this.mfaService) {
        mfaService = this.mfaService;
      } else {
        const { MFAService } = await import('./MFAService');
        mfaService = new MFAService();
      }

      const clientIdForMFA = user.clientId || data.clientId || req?.clientId || '';

      // Check if MFA is required at client level (only if we have a clientId)
      let mfaRequired = false;
      if (clientIdForMFA) {
        mfaRequired = await mfaService.isMFARequired(clientIdForMFA, req);
      }

      // Check if user has MFA enabled and verified (always check, even without clientId)
      // For database-per-tenant, clientId might be empty but user still has MFA
      const mfaEnabled = await mfaService.isMFAEnabled(user.id, clientIdForMFA, req);

      // Check if user has MFA setup (has totpSecret) - needed to distinguish between setup and verification
      const hasMFASetup = await mfaService.hasMFASetup(user.id, clientIdForMFA, req);

      // If MFA is required but user doesn't have setup, they need to set up MFA first
      if (mfaRequired && !hasMFASetup) {
        return { user, tokens: {} as AuthTokens, requiresMFASetup: true };
      }

      // If MFA is required OR user has MFA enabled, don't generate tokens yet - user needs to verify MFA
      if (mfaRequired || mfaEnabled) {
        return { user, tokens: {} as AuthTokens, requiresMFA: true };
      }

      // For database-per-tenant, user might not have clientId, so get it from request
      const clientIdForToken = user.clientId || data.clientId;
      const tokens = await this.generateTokens(user, clientIdForToken);
      await this.saveRefreshToken(user.id, tokens.refreshToken, req);

      // Clear any previous user blacklist on successful login
      // This allows users to log in even if they were previously blacklisted (e.g., from device revocation)
      await this.blacklistService.clearUserBlacklist(user.id).catch((error) => {
        // Log but don't throw - blacklist clearing failures shouldn't break login
        logger.warn('Failed to clear user blacklist on login', {
          error: error.message || 'Unknown error',
          userId: user.id,
        });
      });

      // Update last login timestamp
      await this.updateLastLogin(user.id, req);

      // Track device (async, don't block login)
      if (data.deviceInfo && req) {
        this.trackDevice(user, req, data.deviceInfo).catch((error) => {
          // Log but don't throw - device tracking failures shouldn't break login
          logger.error('Failed to track device', {
            error: error.message || 'Unknown error',
            errorName: error.name,
            errorCode: error.code,
            errorDetail: error.detail,
            errorConstraint: error.constraint,
            errorTable: error.table,
            userId: user.id,
          });
        });
      }

      return { user, tokens };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh an expired access token using a valid refresh token
   * @param refreshToken - The refresh token to use for generating new tokens
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns New access and refresh tokens
   * @throws Error if refresh token is invalid, expired, or user is not found
   */
  async refreshToken(refreshToken: string, clientId: string, req?: TenantRequest): Promise<AuthTokens> {
    // Check if refresh token is blacklisted
    if (await this.blacklistService.isTokenBlacklisted(refreshToken)) {
      throw new Error('Refresh token has been revoked');
    }

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // Check if user's tokens are blacklisted (logout all devices)
    if (await this.blacklistService.isUserBlacklisted(decoded.userId)) {
      throw new Error('User session has been revoked');
    }

    const repository = this.getRepository(req);
    const dataSource = this.getDataSource(req);

    // Handle schema-per-tenant
    let schemaName: string | undefined;
    let isolationLevel: string | undefined;
    let actualRepository = repository;

    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);

      isolationLevel = config.isolationLevel;
    }

    try {
      const where: any = {
        id: decoded.userId,
        isActive: true,
      };

      // Only include clientId for shared
      if (isolationLevel !== 'database' && clientId) {
        where.clientId = clientId;
      }

      const user = await actualRepository.findOne({ where });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
        throw new Error('Refresh token expired');
      }

      // Rotate refresh token
      // For database-per-tenant, user might not have clientId, so use the one from request
      const clientIdForToken = user.clientId || clientId;
      const tokens = await this.generateTokens(user, clientIdForToken);
      await this.saveRefreshToken(user.id, tokens.refreshToken, req);

      // Blacklist old refresh token after successful rotation
      await this.blacklistService.blacklistToken(refreshToken);

      return tokens;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout a user by invalidating their refresh token
   * Also blacklists the refresh token for immediate revocation
   * @param userId - The ID of the user to logout
   * @param req - Optional tenant request context
   * @param accessToken - Optional access token to blacklist
   */
  async logout(userId: string, req?: TenantRequest, accessToken?: string): Promise<void> {
    const repository = this.getRepository(req);
    
    // Get user to retrieve refresh token
    const user = await repository.findOne({ where: { id: userId } });
    
    // Blacklist refresh token if it exists
    if (user?.refreshToken) {
      logger.debug('Blacklisting refresh token on logout', { userId });
      await this.blacklistService.blacklistToken(user.refreshToken);
    } else {
      logger.debug('No refresh token found to blacklist', { userId });
    }
    
    // Blacklist access token if provided
    if (accessToken) {
      logger.debug('Blacklisting access token on logout', { 
        userId,
        tokenLength: accessToken.length,
        tokenPrefix: accessToken.substring(0, 20) + '...'
      });
      await this.blacklistService.blacklistToken(accessToken);
    } else {
      logger.warn('No access token provided for blacklisting on logout', { userId });
    }
    
    // Clear refresh token from database
    await repository.update(
      { id: userId },
      { refreshToken: undefined, refreshTokenExpiresAt: undefined }
    );
  }

  /**
   * Generate JWT access and refresh tokens for a user
   * @param user - The user entity to generate tokens for
   * @param clientId - Optional client ID (defaults to user's clientId)
   * @returns Access token, refresh token, and expiration time in seconds
   */
  async generateTokens(user: User, clientId?: string): Promise<AuthTokens> {
    const payload: JWTPayload = {
      userId: user.id,
      clientId: user.clientId || clientId || '',
      email: user.email,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ userId: user.id }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    const expiresIn = parseInt(config.jwt.expiresIn.replace('m', '')) * 60; // Convert to seconds

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Track device for user login
   * This is called asynchronously after successful login
   */
  private async trackDevice(
    user: User,
    req: TenantRequest,
    deviceInfo: ClientDeviceInfo
  ): Promise<void> {
    try {
      // Convert TenantRequest to Request for DeviceService
      const request = req as unknown as Request;
      
      const result = await this.deviceService.createOrUpdateDevice(
        user.id,
        request,
        deviceInfo,
        req
      );

      // If new device, send notification
      if (result.isNewDevice) {
        const emailService = getEmailService();
        await emailService.sendDeviceChangeNotification(user, result.device);

        // Log security event
        const securityMonitoring = getSecurityMonitoringService();
        securityMonitoring.log({
          type: SecurityEventType.DEVICE_CHANGE,
          severity: 'medium',
          message: 'New device login detected',
          metadata: {
            userId: user.id,
            deviceId: result.device.id,
            deviceName: result.device.deviceName,
            browser: result.device.browser,
            os: result.device.os,
            ipAddress: result.device.ipAddress,
            clientId: req.clientId,
            subdomain: req.tenant?.subdomain || undefined,
          },
          timestamp: new Date(),
        });
      }
    } catch (error: any) {
      // Log detailed error information for debugging
      logger.error('Error tracking device', {
        error: error.message || 'Unknown error',
        errorName: error.name,
        errorCode: error.code,
        errorStack: error.stack,
        userId: user.id,
        hasDeviceInfo: !!deviceInfo,
        deviceInfoKeys: deviceInfo ? Object.keys(deviceInfo) : [],
      });
      // Don't throw - device tracking failures shouldn't break login
    }
  }

  /**
   * Save a refresh token to the database for a user
   * @param userId - The ID of the user
   * @param refreshToken - The refresh token to save
   * @param req - Optional tenant request context
   */
  async saveRefreshToken(userId: string, refreshToken: string, req?: TenantRequest): Promise<void> {
    const repository = this.getRepository(req);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS);

    await repository.update(
      { id: userId },
      { refreshToken, refreshTokenExpiresAt: expiresAt }
    );
  }

  /**
   * Hash a plain text password using bcrypt
   * @param password - The plain text password to hash
   * @returns The hashed password (bcrypt with 10 rounds)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SECURITY_CONSTANTS.BCRYPT_ROUNDS);
  }

  /**
   * Retrieve a user by ID
   * @param userId - The ID of the user to retrieve
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns The user entity with role and client relations, or null if not found
   */
  async getUserById(userId: string, clientId: string, req?: TenantRequest): Promise<User | null> {
    const repository = this.getRepository(req);

    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { id: userId };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    // For database-per-tenant, don't try to load client relation (it doesn't exist in tenant DB)
    const relations = isolationLevel === 'database' ? ['role'] : ['role', 'client'];

    return repository.findOne({
      where,
      relations,
    });
  }

  /**
   * Update the last login timestamp for a user
   * @param userId - The ID of the user
   * @param req - Optional tenant request context
   */
  async updateLastLogin(userId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getRepository(req);
    await repository.update(
      { id: userId },
      { lastLoginAt: new Date() }
    );
  }

  /**
   * Clear user blacklist (useful when user logs in successfully)
   * @param userId - The ID of the user
   */
  async clearUserBlacklist(userId: string): Promise<void> {
    await this.blacklistService.clearUserBlacklist(userId);
  }
}

