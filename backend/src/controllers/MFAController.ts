import { Response, Request } from 'express';
import { AuthenticatedRequest, TenantRequest } from '../types/middleware.types';
import { IMFAService } from '../interfaces/IMFAService';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { PermissionService } from '../services/PermissionService';
import { IAuthService } from '../interfaces/IAuthService';
import { logger } from '../utils/logger';
import { DeviceService } from '../services/DeviceService';
import { ClientDeviceInfo } from '../utils/deviceFingerprint';
import { getEmailService } from '../services/EmailService';
import { getSecurityMonitoringService, SecurityEventType } from '../services/SecurityMonitoringService';

export class MFAController {
  private deviceService: DeviceService;

  constructor(
    private mfaService: IMFAService,
    private permissionService: PermissionService,
    private authService: IAuthService
  ) {
    this.deviceService = new DeviceService();
  }

  /**
   * Setup MFA for the current user
   */
  async setupMFA(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';

      if (!userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      const result = await this.mfaService.setupMFA(userId, clientId, req);

      sendSuccess(res, {
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to setup MFA';
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      logger.error('Failed to setup MFA', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Setup MFA during login (public endpoint, accepts userId and clientId)
   * Only works if MFA is required for the user/client
   */
  async setupMFALogin(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { userId, clientId } = req.body;

      if (!userId || !clientId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'UserId and clientId are required', 400);
        return;
      }

      // Verify that MFA is required for this user/client
      const mfaRequired = await this.mfaService.isMFARequired(clientId, req);
      if (!mfaRequired) {
        sendError(res, ERROR_CODES.FORBIDDEN, 'MFA is not required for this client', 403);
        return;
      }

      // Verify user doesn't already have MFA set up
      const hasSetup = await this.mfaService.hasMFASetup(userId, clientId, req);
      if (hasSetup) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'MFA is already set up for this user', 400);
        return;
      }

      const result = await this.mfaService.setupMFA(userId, clientId, req);

      sendSuccess(res, {
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to setup MFA';
      const userId = req.body?.userId;
      const clientId = req.body?.clientId || req.clientId || '';
      logger.error('Failed to setup MFA during login', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Verify and enable MFA during login (public endpoint, accepts userId and clientId)
   * After verification, generates tokens and returns them
   */
  async verifyAndEnableMFALogin(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { userId, clientId, token, secret, backupCodes } = req.body;

      if (!userId || !clientId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'UserId and clientId are required', 400);
        return;
      }

      if (!token || !secret || !backupCodes) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Token, secret, and backupCodes are required', 400);
        return;
      }

      if (!Array.isArray(backupCodes)) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'backupCodes must be an array', 400);
        return;
      }

      // Verify and enable MFA
      const result = await this.mfaService.verifyAndEnableMFA(userId, clientId, token, secret, backupCodes, req);

      if (!result.valid) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Invalid token', 400);
        return;
      }

      // After MFA verification, generate tokens for the user
      const user = await this.authService.getUserById(userId, clientId, req);

      if (!user) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not found', 401);
        return;
      }

      // Generate tokens
      const tokens = await this.authService.generateTokens(user, clientId);
      await this.authService.saveRefreshToken(user.id, tokens.refreshToken, req);

      // Clear any previous user blacklist on successful login
      await this.authService.clearUserBlacklist(userId).catch((error) => {
        logger.warn('Failed to clear user blacklist after MFA setup', {
          error: error.message || 'Unknown error',
          userId,
        });
      });

      // Update last login timestamp after successful MFA setup and verification
      await this.authService.updateLastLogin(userId, req);

      // Track device (async, don't block login)
      if (req.body.deviceInfo && req) {
        this.trackDevice(user, req, req.body.deviceInfo).catch((error) => {
          logger.error('Failed to track device after MFA setup', {
            error: error.message,
            userId: user.id,
          });
        });
      }

      sendSuccess(res, {
        enabled: true,
        usedBackupCode: result.usedBackupCode,
        tokens,
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
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify and enable MFA';
      const userId = req.body?.userId;
      const clientId = req.body?.clientId || req.clientId || '';
      logger.error('Failed to verify and enable MFA during login', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Verify and enable MFA for the current user
   * Requires secret and backupCodes from setup step
   */
  async verifyAndEnableMFA(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      const { token, secret, backupCodes } = req.body;

      if (!userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      if (!token || !secret || !backupCodes) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Token, secret, and backupCodes are required', 400);
        return;
      }

      if (!Array.isArray(backupCodes)) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'backupCodes must be an array', 400);
        return;
      }

      const result = await this.mfaService.verifyAndEnableMFA(userId, clientId, token, secret, backupCodes, req);

      if (!result.valid) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Invalid token', 400);
        return;
      }

      sendSuccess(res, {
        enabled: true,
        usedBackupCode: result.usedBackupCode,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify MFA';
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      logger.error('Failed to verify and enable MFA', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Verify MFA token (for login) and return tokens
   */
  async verifyMFA(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { userId, token } = req.body;

      if (!userId || !token) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'UserId and token are required', 400);
        return;
      }

      // Get clientId from request or body
      const clientId = req.clientId || req.body.clientId || '';

      const result = await this.mfaService.verifyMFA(userId, clientId, token, req);

      if (!result.valid) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Invalid token', 400);
        return;
      }

      // After MFA verification, generate tokens for the user
      // Get user to generate tokens
      const user = await this.authService.getUserById(userId, clientId, req);

      if (!user) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not found', 401);
        return;
      }

      // Generate tokens
      const tokens = await this.authService.generateTokens(user, clientId);
      await this.authService.saveRefreshToken(user.id, tokens.refreshToken, req);

      // Clear any previous user blacklist on successful login
      await this.authService.clearUserBlacklist(userId).catch((error) => {
        logger.warn('Failed to clear user blacklist after MFA verification', {
          error: error.message || 'Unknown error',
          userId,
        });
      });

      // Update last login timestamp after successful MFA verification
      await this.authService.updateLastLogin(userId, req);

      // Track device (async, don't block login)
      if (req.body.deviceInfo && req) {
        this.trackDevice(user, req, req.body.deviceInfo).catch((error) => {
          logger.error('Failed to track device after MFA verification', {
            error: error.message,
            userId: user.id,
          });
        });
      }

      sendSuccess(res, {
        tokens,
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
        usedBackupCode: result.usedBackupCode,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify MFA';
      const userId = req.body.userId;
      const clientId = req.body.clientId || req.clientId || '';
      logger.error('Failed to verify MFA during login', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Disable MFA for the current user
   */
  async disableMFA(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';

      if (!userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      await this.mfaService.disableMFA(userId, clientId, req);

      sendSuccess(res, { disabled: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disable MFA';
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      logger.error('Failed to disable MFA', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Reset MFA for a user (admin action)
   */
  async resetMFA(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      const { targetUserId } = req.body;

      if (!userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      if (!targetUserId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Target user ID is required', 400);
        return;
      }

      // Check permission: user:mfa-reset
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        clientId,
        'user',
        'mfa-reset',
        undefined,
        undefined,
        req
      );

      if (!hasPermission) {
        sendError(res, ERROR_CODES.FORBIDDEN, 'You do not have permission to reset MFA', 403);
        return;
      }

      await this.mfaService.resetMFA(targetUserId, clientId, req);

      sendSuccess(res, { reset: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset MFA';
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      const targetUserId = req.body?.targetUserId;
      logger.error('Failed to reset MFA', { error: errorMessage, userId, clientId, targetUserId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Get backup codes for the current user
   */
  async getBackupCodes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';

      if (!userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      const codes = await this.mfaService.getBackupCodes(userId, clientId, req);

      sendSuccess(res, { backupCodes: codes });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get backup codes';
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      logger.error('Failed to get backup codes', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Regenerate backup codes for the current user
   */
  async regenerateBackupCodes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';

      if (!userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      const codes = await this.mfaService.regenerateBackupCodes(userId, clientId, req);

      sendSuccess(res, { backupCodes: codes });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate backup codes';
      const userId = req.userId || req.user?.id;
      const clientId = req.clientId || req.user?.clientId || '';
      logger.error('Failed to regenerate backup codes', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Check MFA status for the current user
   */
  async getMFAStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const clientId = req.user?.clientId || '';

      if (!userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      const isEnabled = await this.mfaService.isMFAEnabled(userId, clientId, req);
      const isEnforced = await this.mfaService.isMFAEnforced(clientId);
      const isRequired = await this.mfaService.isMFARequired(clientId);

      sendSuccess(res, {
        enabled: isEnabled,
        enforced: isEnforced,
        required: isRequired,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get MFA status';
      const userId = req.user?.id;
      const clientId = req.user?.clientId || '';
      logger.error('Failed to get MFA status', { error: errorMessage, userId, clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  /**
   * Track device for user login
   * This is called asynchronously after successful MFA verification
   */
  private async trackDevice(
    user: any,
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
        errorDetail: error.detail,
        errorConstraint: error.constraint,
        errorTable: error.table,
        errorStack: error.stack,
        userId: user.id,
        hasDeviceInfo: !!deviceInfo,
        deviceInfoKeys: deviceInfo ? Object.keys(deviceInfo) : [],
      });
      // Don't throw - device tracking failures shouldn't break login
    }
  }
}

