import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { DeviceService } from '../services/DeviceService';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { getEmailService } from '../services/EmailService';
import { TokenBlacklistService } from '../services/TokenBlacklistService';
import { logger } from '../utils/logger';
import { asParam } from '../utils/params';

export class DeviceController {
  private deviceService: DeviceService;

  constructor() {
    this.deviceService = new DeviceService();
  }

  /**
   * Get all devices for the authenticated user
   */
  async getDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      const devices = await this.deviceService.getUserDevices(
        req.userId,
        req as any
      );

      sendSuccess(res, devices);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  /**
   * Revoke a device (mark as inactive)
   */
  async revokeDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      const deviceId = asParam(req.params.deviceId);

      if (!deviceId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Device ID is required', 400);
        return;
      }

      // Get device before revoking to send notification
      const device = await this.deviceService.getDeviceById(
        req.userId,
        deviceId,
        req as any
      );

      if (!device) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Device not found', 404);
        return;
      }

      await this.deviceService.revokeDevice(req.userId, deviceId, req as any);

      logger.info('Device revoked successfully', {
        userId: req.userId,
        deviceId,
        deviceName: device.deviceName,
      });

      // Send notification email
      if (req.user) {
        const emailService = getEmailService();
        await emailService.sendDeviceRevokedNotification(req.user, device);
      }

      sendSuccess(res, { message: 'Device revoked successfully. The device will be logged out on its next request.' });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  /**
   * Rename a device
   */
  async renameDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'User not authenticated', 401);
        return;
      }

      const deviceId = asParam(req.params.deviceId);
      const { deviceName } = req.body;

      if (!deviceId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Device ID is required', 400);
        return;
      }

      if (!deviceName || typeof deviceName !== 'string' || deviceName.trim().length === 0) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Device name is required', 400);
        return;
      }

      const device = await this.deviceService.renameDevice(
        req.userId,
        deviceId,
        deviceName.trim(),
        req as any
      );

      sendSuccess(res, device);
    } catch (error: any) {
      if (error.message === 'Device not found') {
        sendError(res, ERROR_CODES.NOT_FOUND, error.message, 404);
      } else {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
      }
    }
  }
}

