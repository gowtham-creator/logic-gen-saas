import { Router, Request, Response, NextFunction } from 'express';
import { DeviceController } from '../controllers/DeviceController';
import { authMiddleware } from '../middleware/auth';
import { validate, schemas } from '../utils/validation';
import { AuthenticatedRequest } from '../types/middleware.types';
import Joi from 'joi';

const router = Router();
const controller = new DeviceController();

// Validation schemas
const renameDeviceSchema = {
  body: Joi.object({
    deviceName: Joi.string().required().min(1).max(100),
  }),
};

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Get user devices
 *     description: Get all active devices for the authenticated user
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user devices
 */
router.get(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    controller.getDevices(req as AuthenticatedRequest, res).catch(next);
  }
);

/**
 * @swagger
 * /api/devices/{deviceId}/revoke:
 *   delete:
 *     summary: Revoke device
 *     description: Revoke access for a specific device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Device revoked successfully
 *       404:
 *         description: Device not found
 */
router.delete(
  '/:deviceId/revoke',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    controller.revokeDevice(req as AuthenticatedRequest, res).catch(next);
  }
);

/**
 * @swagger
 * /api/devices/{deviceId}/rename:
 *   patch:
 *     summary: Rename device
 *     description: Rename a device for easier identification
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceName
 *             properties:
 *               deviceName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Device renamed successfully
 *       404:
 *         description: Device not found
 */
router.post(
  '/:deviceId/rename',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  validate(renameDeviceSchema),
  (req: Request, res: Response, next: NextFunction) => {
    controller.renameDevice(req as AuthenticatedRequest, res).catch(next);
  }
);

export default router;

