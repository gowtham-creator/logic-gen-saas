import { Router, Request, Response, NextFunction } from 'express';
import { getMFAController } from '../config/dependencyInjection';
import { authMiddleware } from '../middleware/auth';
import { validate, schemas } from '../utils/validation';
import { AuthenticatedRequest, TenantRequest } from '../types/middleware.types';
import Joi from 'joi';

const router = Router();
const controller = getMFAController();

// Validation schemas
const verifyMFASchema = {
  body: Joi.object({
    token: Joi.string().required().length(6),
    secret: Joi.string().required(),
    backupCodes: Joi.array().items(Joi.string()).min(1).required(),
  }),
};

const resetMFASchema = {
  body: Joi.object({
    targetUserId: Joi.string().uuid().required(),
  }),
};

/**
 * @swagger
 * /api/mfa/setup:
 *   post:
 *     summary: Setup MFA for current user
 *     description: Generate TOTP secret and QR code for MFA setup
 *     tags: [MFA]
 *     responses:
 *       200:
 *         description: MFA setup initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     secret:
 *                       type: string
 *                     qrCodeUrl:
 *                       type: string
 *                     backupCodes:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.post(
  '/setup',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.setupMFA(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/mfa/verify:
 *   post:
 *     summary: Verify and enable MFA
 *     description: Verify TOTP token and enable MFA for current user
 *     tags: [MFA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 length: 6
 *     responses:
 *       200:
 *         description: MFA enabled successfully
 */
router.post(
  '/verify',
  validate(verifyMFASchema),
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.verifyAndEnableMFA(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/mfa/verify-login:
 *   post:
 *     summary: Verify MFA token during login
 *     description: Verify MFA token for login flow
 *     tags: [MFA]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - token
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               token:
 *                 type: string
 *                 length: 6
 *     responses:
 *       200:
 *         description: MFA verified successfully
 */
router.post('/verify-login', validate({
  body: Joi.object({
    userId: Joi.string().uuid().required(),
    token: Joi.string().required().length(6),
    clientId: Joi.string().uuid().optional(),
    deviceInfo: Joi.object({
      clientDeviceId: Joi.string().optional(),
      screenWidth: Joi.number().optional(),
      screenHeight: Joi.number().optional(),
      timezone: Joi.string().optional(),
      colorDepth: Joi.number().optional(),
      hardwareConcurrency: Joi.number().optional(),
      platform: Joi.string().optional(),
      language: Joi.string().optional(),
      canvasFingerprint: Joi.string().optional(),
      webglFingerprint: Joi.string().optional(),
    }).optional(),
  }),
}), (req: Request, res: Response) => controller.verifyMFA(req as TenantRequest, res));

/**
 * @swagger
 * /api/mfa/disable:
 *   post:
 *     summary: Disable MFA for current user
 *     description: Disable MFA for the authenticated user
 *     tags: [MFA]
 *     responses:
 *       200:
 *         description: MFA disabled successfully
 */
router.post(
  '/disable',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.disableMFA(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/mfa/reset:
 *   post:
 *     summary: Reset MFA for a user (admin)
 *     description: Admin endpoint to reset MFA for any user
 *     tags: [MFA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: MFA reset successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  '/reset',
  validate(resetMFASchema),
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.resetMFA(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/mfa/backup-codes:
 *   get:
 *     summary: Get backup codes for current user
 *     description: Retrieve backup codes for the authenticated user
 *     tags: [MFA]
 *     responses:
 *       200:
 *         description: Backup codes retrieved
 */
router.get(
  '/backup-codes',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.getBackupCodes(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/mfa/regenerate-backup-codes:
 *   post:
 *     summary: Regenerate backup codes
 *     description: Generate new backup codes for the authenticated user
 *     tags: [MFA]
 *     responses:
 *       200:
 *         description: Backup codes regenerated
 */
router.post(
  '/regenerate-backup-codes',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.regenerateBackupCodes(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/mfa/status:
 *   get:
 *     summary: Get MFA status
 *     description: Get MFA status for the authenticated user
 *     tags: [MFA]
 *     responses:
 *       200:
 *         description: MFA status retrieved
 */
router.get(
  '/status',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.getMFAStatus(req as AuthenticatedRequest, res)
);

// Public route for MFA setup during login (when MFA is required but user hasn't set it up)
const setupMFALoginSchema = {
  body: Joi.object({
    userId: Joi.string().uuid().required(),
    clientId: Joi.string().uuid().required(),
  }),
};
router.post('/setup-login', validate(setupMFALoginSchema), (req: Request, res: Response) => controller.setupMFALogin(req as TenantRequest, res));

// Public route for MFA verify and enable during login
const verifyAndEnableMFALoginSchema = {
  body: Joi.object({
    userId: Joi.string().uuid().required(),
    clientId: Joi.string().uuid().required(),
    token: Joi.string().required().length(6),
    secret: Joi.string().required(),
    backupCodes: Joi.array().items(Joi.string()).min(1).required(),
    deviceInfo: Joi.object({
      clientDeviceId: Joi.string().optional(),
      screenWidth: Joi.number().optional(),
      screenHeight: Joi.number().optional(),
      timezone: Joi.string().optional(),
      colorDepth: Joi.number().optional(),
      hardwareConcurrency: Joi.number().optional(),
      platform: Joi.string().optional(),
      language: Joi.string().optional(),
      canvasFingerprint: Joi.string().optional(),
      webglFingerprint: Joi.string().optional(),
    }).optional(),
  }),
};
router.post('/verify-and-enable-login', validate(verifyAndEnableMFALoginSchema), (req: Request, res: Response) => controller.verifyAndEnableMFALogin(req as TenantRequest, res));

export default router;

