import { Router, Request, Response, NextFunction } from 'express';
import { PermissionController } from '../controllers/PermissionController';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new PermissionController();

// All routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const idParamSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

const updatePermissionSchema = {
  body: Joi.object({
    elementId: Joi.string().allow(null, '').optional(),
    description: Joi.string().optional(),
  }),
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * @swagger
 * /api/permissions:
 *   get:
 *     summary: List all permissions
 *     description: Get a list of all available permissions. Used for role management.
 *     tags: [Permissions]
 *     responses:
 *       200:
 *         description: List of permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       resource:
 *                         type: string
 *                         example: user
 *                       action:
 *                         type: string
 *                         example: create
 *                       elementId:
 *                         type: string
 *                         nullable: true
 *                       description:
 *                         type: string
 */
// Routes - Allow authenticated users to read permissions (needed for role management)
router.get(
  '/',
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/permissions/{id}:
 *   get:
 *     summary: Get permission by ID
 *     description: Get details of a specific permission
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Permission details
 *       404:
 *         description: Permission not found
 *   put:
 *     summary: Update a permission
 *     description: Update permission metadata (elementId, description)
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               elementId:
 *                 type: string
 *                 nullable: true
 *                 example: btn-create-user
 *               description:
 *                 type: string
 *                 example: Permission to create new users
 *     responses:
 *       200:
 *         description: Permission updated successfully
 */
router.get(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    controller.get(req as any, res).catch(next);
  }
);

router.put(
  '/:id',
  validate(updatePermissionSchema),
  (req, res, next) => {
    rbacMiddleware('permission', 'update')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

export default router;

