import { Repository, DataSource } from 'typeorm';
import { Request } from 'express';
import { AppDataSource } from '../config/database';
import { UserDevice } from '../entities/UserDevice';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository, getTenantDataSource } from '../utils/tenantRepository';
import {
  generateDeviceFingerprint,
  generateDeviceName,
  extractBrowser,
  extractOS,
  detectDeviceType,
  ClientDeviceInfo,
} from '../utils/deviceFingerprint';
import { logger } from '../utils/logger';
import { SECURITY_CONSTANTS } from '../constants/security';

export interface DeviceDetectionResult {
  isNewDevice: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
  device?: UserDevice;
}

export class DeviceService {
  private getRepository(req?: TenantRequest): Repository<UserDevice> {
    if (req) {
      return getTenantRepository(req, UserDevice);
    }
    return AppDataSource.getRepository(UserDevice);
  }

  private getDataSource(req?: TenantRequest): DataSource {
    if (req) {
      return getTenantDataSource(req);
    }
    return AppDataSource;
  }

  /**
   * Detect if this is a new device using multiple factors
   */
  async detectDevice(
    userId: string,
    req: Request,
    deviceInfo: ClientDeviceInfo,
    reqContext?: TenantRequest
  ): Promise<DeviceDetectionResult> {
    const repository = this.getRepository(reqContext);
    const clientDeviceId = deviceInfo.clientDeviceId || 'unknown';
    const fingerprint = generateDeviceFingerprint(req, deviceInfo);

    // Factor 1: Check by client device ID (most reliable)
    if (clientDeviceId !== 'unknown') {
      // First check for active device
      let deviceByClientId = await repository.findOne({
        where: {
          userId,
          clientDeviceId: clientDeviceId,
          isActive: true,
        },
      });

      // If not found, check for inactive device (to reactivate it)
      if (!deviceByClientId) {
        deviceByClientId = await repository.findOne({
          where: {
            userId,
            clientDeviceId: clientDeviceId,
            isActive: false,
          },
        });
        
        // Reactivate the device if found
        if (deviceByClientId) {
          deviceByClientId.isActive = true;
        }
      }

      if (deviceByClientId) {
        // Same device - update fingerprint if it changed
        if (deviceByClientId.deviceId !== fingerprint) {
          deviceByClientId.deviceId = fingerprint;
        }
        deviceByClientId.lastSeenAt = new Date();
        deviceByClientId.ipAddress = req.ip;
        await repository.save(deviceByClientId);

        return {
          isNewDevice: false,
          confidence: 'high',
          reason: 'Matched by client device ID',
          device: deviceByClientId,
        };
      }
    }

    // Factor 2: Check by fingerprint
    const deviceByFingerprint = await repository.findOne({
      where: {
        userId,
        deviceId: fingerprint,
        isActive: true,
      },
    });

    if (deviceByFingerprint) {
      // Potential match, but could be false positive

      // Factor 3: Check if client device ID exists but doesn't match
      if (
        clientDeviceId !== 'unknown' &&
        deviceByFingerprint.clientDeviceId &&
        deviceByFingerprint.clientDeviceId !== clientDeviceId
      ) {
        // Different client device ID = different physical device
        return {
          isNewDevice: true,
          confidence: 'high',
          reason: 'Fingerprint matches but client device ID differs',
        };
      }

      // Factor 4: Check suspicious patterns
      const isSuspicious = await this.checkSuspiciousPattern(
        userId,
        deviceByFingerprint,
        req.ip || '',
        reqContext
      );

      if (isSuspicious) {
        return {
          isNewDevice: true,
          confidence: 'medium',
          reason: 'Fingerprint matches but suspicious pattern detected',
        };
      }

      // Update existing device
      if (clientDeviceId !== 'unknown' && !deviceByFingerprint.clientDeviceId) {
        deviceByFingerprint.clientDeviceId = clientDeviceId;
      }
      deviceByFingerprint.lastSeenAt = new Date();
      deviceByFingerprint.ipAddress = req.ip;
      await repository.save(deviceByFingerprint);

      return {
        isNewDevice: false,
        confidence: deviceByFingerprint.clientDeviceId ? 'high' : 'medium',
        reason: 'Matched by fingerprint',
        device: deviceByFingerprint,
      };
    }

    // No match found - new device
    return {
      isNewDevice: true,
      confidence: clientDeviceId !== 'unknown' ? 'high' : 'medium',
      reason: 'No matching device found',
    };
  }

  /**
   * Check for suspicious patterns that might indicate different device
   */
  private async checkSuspiciousPattern(
    userId: string,
    existingDevice: UserDevice,
    currentIP: string,
    reqContext?: TenantRequest
  ): Promise<boolean> {
    const repository = this.getRepository(reqContext);

    // Check 1: Simultaneous logins from different IPs
    const recentDevices = await repository.find({
      where: { userId, isActive: true },
      order: { lastSeenAt: 'DESC' },
      take: SECURITY_CONSTANTS.MAX_RECENT_DEVICES,
    });

    const hasSimultaneousLogin = recentDevices.some((device) => {
      if (!device.lastSeenAt || device.id === existingDevice.id) return false;
      const timeDiff = Math.abs(Date.now() - device.lastSeenAt.getTime());
      // If another device was active within configured window
      return timeDiff < SECURITY_CONSTANTS.SIMULTANEOUS_LOGIN_WINDOW_MS && device.ipAddress !== currentIP;
    });

    if (hasSimultaneousLogin) {
      logger.warn('Suspicious device pattern detected: simultaneous login', {
        userId,
        deviceId: existingDevice.id,
        currentIP,
      });
      return true;
    }

    // Check 2: Multiple devices with same fingerprint
    const devicesWithSameFingerprint = await repository.count({
      where: {
        userId,
        deviceId: existingDevice.deviceId,
        isActive: true,
      },
    });

    if (devicesWithSameFingerprint > 1) {
      logger.warn('Suspicious device pattern: multiple devices with same fingerprint', {
        userId,
        deviceId: existingDevice.deviceId,
        count: devicesWithSameFingerprint,
      });
      return true;
    }

    return false;
  }

  /**
   * Create or update device record
   */
  async createOrUpdateDevice(
    userId: string,
    req: Request,
    deviceInfo: ClientDeviceInfo,
    reqContext?: TenantRequest
  ): Promise<{ device: UserDevice; isNewDevice: boolean }> {
    try {
      const repository = this.getRepository(reqContext);
      const detection = await this.detectDevice(userId, req, deviceInfo, reqContext);

      if (!detection.isNewDevice && detection.device) {
        // Update existing device
        detection.device.lastSeenAt = new Date();
        detection.device.ipAddress = req.ip;
        if (deviceInfo.clientDeviceId && !detection.device.clientDeviceId) {
          detection.device.clientDeviceId = deviceInfo.clientDeviceId;
        }
        const updated = await repository.save(detection.device);
        return { device: updated, isNewDevice: false };
      }

      // Create new device
      const userAgent = req.get('user-agent');
      const newDevice = repository.create({
        userId,
        deviceId: generateDeviceFingerprint(req, deviceInfo),
        clientDeviceId: deviceInfo.clientDeviceId || undefined,
        deviceName: generateDeviceName(userAgent, deviceInfo),
        deviceType: detectDeviceType(deviceInfo, userAgent),
        browser: extractBrowser(userAgent),
        os: extractOS(userAgent),
        ipAddress: req.ip,
        lastSeenAt: new Date(),
        isActive: true,
      });

      const saved = await repository.save(newDevice);
      return { device: saved, isNewDevice: true };
    } catch (error: any) {
      // Log detailed error for debugging
      logger.error('Error in createOrUpdateDevice', {
        error: error.message || 'Unknown error',
        errorName: error.name,
        errorCode: error.code,
        errorDetail: error.detail,
        errorConstraint: error.constraint,
        errorTable: error.table,
        userId,
        hasDeviceInfo: !!deviceInfo,
        clientDeviceId: deviceInfo?.clientDeviceId,
        ipAddress: req.ip,
      });
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string, reqContext?: TenantRequest): Promise<UserDevice[]> {
    const repository = this.getRepository(reqContext);
    return repository.find({
      where: {
        userId,
        isActive: true,
      },
      order: {
        lastSeenAt: 'DESC',
      },
    });
  }

  /**
   * Revoke a device (mark as inactive)
   */
  async revokeDevice(
    userId: string,
    deviceId: string,
    reqContext?: TenantRequest
  ): Promise<void> {
    const repository = this.getRepository(reqContext);
    await repository.update(
      {
        id: deviceId,
        userId,
      },
      {
        isActive: false,
      }
    );
  }

  /**
   * Rename a device
   */
  async renameDevice(
    userId: string,
    deviceId: string,
    newName: string,
    reqContext?: TenantRequest
  ): Promise<UserDevice> {
    const repository = this.getRepository(reqContext);
    const device = await repository.findOne({
      where: {
        id: deviceId,
        userId,
        isActive: true,
      },
    });

    if (!device) {
      throw new Error('Device not found');
    }

    device.deviceName = newName;
    return repository.save(device);
  }

  /**
   * Get device by ID
   */
  async getDeviceById(
    userId: string,
    deviceId: string,
    reqContext?: TenantRequest
  ): Promise<UserDevice | null> {
    const repository = this.getRepository(reqContext);
    return repository.findOne({
      where: {
        id: deviceId,
        userId,
        isActive: true,
      },
    });
  }
}

