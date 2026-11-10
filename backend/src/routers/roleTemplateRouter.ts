import { Router, Request, Response, NextFunction } from 'express';
import { RoleTemplateController } from '../controllers/RoleTemplateController';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new RoleTemplateController();

// All routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const createTemplateSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required().min(1).messages({
      'string.empty': 'Description cannot be empty',
      'any.required': 'Description is required',
    }),
    permissionIds: Joi.array().items(Joi.string().uuid()).min(0).optional().default([]),
  }),
};

const updateTemplateSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().min(1).messages({
      'string.empty': 'Description cannot be empty',
    }).optional(),
    permissionIds: Joi.array().items(Joi.string().uuid()).min(0).optional(),
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
 * /api/role-templates:
 *   post:
 *     summary: Create a new role template
 *     description: Create a reusable role template with predefined permissions
 *     tags: [Role Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: Manager Template
 *               description:
 *                 type: string
 *                 example: Template for manager roles with standard permissions
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 default: []
 *     responses:
 *       201:
 *         description: Role template created successfully
 *   get:
 *     summary: List all role templates
 *     description: Get a list of all role templates for the current client
 *     tags: [Role Templates]
 *     responses:
 *       200:
 *         description: List of role templates
 */
// Routes
router.post(
  '/',
  validate(createTemplateSchema),
  (req, res, next) => {
    rbacMiddleware('role_template', 'create')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.create(req as any, res).catch(next);
  }
);

router.get(
  '/',
  (req, res, next) => {
    rbacMiddleware('role_template', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/role-templates/{id}:
 *   get:
 *     summary: Get role template by ID
 *     description: Get details of a specific role template
 *     tags: [Role Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Role template details
 *       404:
 *         description: Role template not found
 *   put:
 *     summary: Update a role template
 *     description: Update role template details and permissions
 *     tags: [Role Templates]
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
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Role template updated successfully
 *   delete:
 *     summary: Delete a role template
 *     description: Delete a role template
 *     tags: [Role Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Role template deleted successfully
 */
router.get(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('role_template', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.get(req as any, res).catch(next);
  }
);

router.put(
  '/:id',
  validate(updateTemplateSchema),
  (req, res, next) => {
    rbacMiddleware('role_template', 'update')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

router.delete(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('role_template', 'delete')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.delete(req as any, res).catch(next);
  }
);

export default router;

