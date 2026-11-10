import { Router, Request, Response, NextFunction } from 'express';
import { RoleController } from '../controllers/RoleController';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new RoleController();

// All routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const createRoleSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    parentRoleId: schemas.uuid.allow(null).optional(),
    templateId: schemas.uuid.allow(null).optional(),
    permissionIds: Joi.array().items(Joi.string().uuid()).when('templateId', {
      is: Joi.exist().not(null),
      then: Joi.array().items(Joi.string().uuid()).min(0).optional(),
      otherwise: Joi.array().items(Joi.string().uuid()).min(1).required(),
    }),
    isActive: Joi.boolean().optional(),
  }),
};

const updateRoleSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    parentRoleId: schemas.uuid.allow(null).optional(),
    templateId: schemas.uuid.allow(null).optional(),
    permissionIds: Joi.array().items(Joi.string().uuid()).when('templateId', {
      is: Joi.exist().not(null),
      then: Joi.array().items(Joi.string().uuid()).min(0).optional(),
      otherwise: Joi.array().items(Joi.string().uuid()).min(0).optional(),
    }),
    isActive: Joi.boolean().optional(),
  }),
  params: Joi.object({
    id: schemas.uuid,
  }),
};

const idParamSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     description: Create a new role with permissions. Can optionally use a template or parent role.
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Administrator
 *               description:
 *                 type: string
 *                 example: Full access to all resources
 *               parentRoleId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               templateId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ['123e4567-e89b-12d3-a456-426614174000']
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *   get:
 *     summary: List all roles
 *     description: Get a list of all roles for the current client
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: List of roles
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
 *                     $ref: '#/components/schemas/Role'
 */
// Routes
router.post(
  '/',
  validate(createRoleSchema),
  (req, res, next) => {
    rbacMiddleware('role', 'create')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.create(req as any, res).catch(next);
  }
);

router.get(
  '/',
  (req, res, next) => {
    rbacMiddleware('role', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     description: Get details of a specific role including its permissions
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Role details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       404:
 *         description: Role not found
 *   put:
 *     summary: Update a role
 *     description: Update role details and permissions
 *     tags: [Roles]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parentRoleId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               templateId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Role not found
 *   delete:
 *     summary: Delete a role
 *     description: Delete a role. This will fail if the role is assigned to users.
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 *       400:
 *         description: Cannot delete role that is assigned to users
 */
router.get(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('role', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.get(req as any, res).catch(next);
  }
);

router.put(
  '/:id',
  validate(updateRoleSchema),
  (req, res, next) => {
    rbacMiddleware('role', 'update')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

router.delete(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('role', 'delete')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.delete(req as any, res).catch(next);
  }
);

export default router;

