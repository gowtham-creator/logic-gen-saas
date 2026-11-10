import { Router, Request, Response, NextFunction } from 'express';
import { StorageController } from '../controllers/StorageController';
import { combinedAuthMiddleware } from '../middleware/combinedAuth';
import { authMiddleware } from '../middleware/auth';
import { superAdminMiddleware } from '../middleware/superAdmin';
import { validate } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new StorageController();

// All routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  combinedAuthMiddleware(req as any, res, next).catch(next);
});

// Validation schemas
const setStorageConfigSchema = {
  body: Joi.object({
    storageEngineId: Joi.string().uuid().required(),
    config: Joi.object().required(),
  }),
};

/**
 * @swagger
 * /api/storage/engines:
 *   get:
 *     summary: Get all available storage engines
 *     tags: [Storage]
 *     responses:
 *       200:
 *         description: List of storage engines
 */
router.get('/engines', (req, res, next) => {
  controller.getStorageEngines(req as any, res).catch(next);
});

/**
 * @swagger
 * /api/storage/default:
 *   get:
 *     summary: Get default storage configuration
 *     tags: [Storage]
 *     responses:
 *       200:
 *         description: Default storage configuration
 *   post:
 *     summary: Set default storage configuration (Super Admin only)
 *     tags: [Storage]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storageEngineId
 *               - config
 *             properties:
 *               storageEngineId:
 *                 type: string
 *                 format: uuid
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Storage configuration saved
 */
router.get('/default', 
  async (req, res, next) => {
    await authMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    await superAdminMiddleware(req as any, res, next);
  },
  (req, res, next) => {
    controller.getDefaultStorageConfig(req as any, res).catch(next);
  }
);

router.post(
  '/default',
  async (req, res, next) => {
    await authMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    await superAdminMiddleware(req as any, res, next);
  },
  validate(setStorageConfigSchema),
  (req, res, next) => {
    controller.setDefaultStorageConfig(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/storage/clients/{clientId}:
 *   get:
 *     summary: Get client storage configuration
 *     tags: [Storage]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Client storage configuration
 *   post:
 *     summary: Set client storage configuration (overrides default)
 *     tags: [Storage]
 *     parameters:
 *       - in: path
 *         name: clientId
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
 *               - storageEngineId
 *               - config
 *             properties:
 *               storageEngineId:
 *                 type: string
 *                 format: uuid
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Storage configuration saved
 */
router.get('/clients/:clientId', (req, res, next) => {
  controller.getClientStorageConfig(req as any, res).catch(next);
});

router.post(
  '/clients/:clientId',
  validate(setStorageConfigSchema),
  (req, res, next) => {
    controller.setClientStorageConfig(req as any, res).catch(next);
  }
);

export default router;

