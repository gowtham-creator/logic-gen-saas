import { Router, Request, Response, NextFunction } from 'express';
import { PlanController } from '../controllers/PlanController';
import { combinedAuthMiddleware } from '../middleware/combinedAuth';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new PlanController();

// All routes require authentication (accepts both regular user and super admin tokens)
router.use((req: Request, res: Response, next: NextFunction) => {
  combinedAuthMiddleware(req as any, res, next).catch(next);
});

// Validation schemas
const createPlanSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    price: Joi.number().optional(),
    billingPeriod: Joi.string().optional(),
    allowedPermissions: Joi.object().pattern(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).required(),
    limits: Joi.object().pattern(
      Joi.string(),
      Joi.number()
    ).required(),
    databasePermissions: Joi.object({
      allowedIsolationLevels: Joi.array().items(
        Joi.string().valid('shared', 'schema', 'database')
      ).min(1).required(),
      allowCustomTables: Joi.boolean().optional(),
      allowCustomColumns: Joi.boolean().optional(),
      allowCustomMigrations: Joi.boolean().optional(),
      maxCustomTables: Joi.number().integer().positive().allow(null).optional(),
      maxCustomColumns: Joi.number().integer().positive().allow(null).optional(),
    }).optional(),
    isActive: Joi.boolean().optional(),
  }),
};

const updatePlanSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    price: Joi.number().optional(),
    billingPeriod: Joi.string().optional(),
    allowedPermissions: Joi.object().pattern(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    limits: Joi.object().pattern(
      Joi.string(),
      Joi.number()
    ).optional(),
    databasePermissions: Joi.object({
      allowedIsolationLevels: Joi.array().items(
        Joi.string().valid('shared', 'schema', 'database')
      ).min(1).optional(),
      allowCustomTables: Joi.boolean().optional(),
      allowCustomColumns: Joi.boolean().optional(),
      allowCustomMigrations: Joi.boolean().optional(),
      maxCustomTables: Joi.number().integer().positive().allow(null).optional(),
      maxCustomColumns: Joi.number().integer().positive().allow(null).optional(),
    }).optional(),
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
 * /api/plans:
 *   post:
 *     summary: Create a new plan (Super Admin only)
 *     description: Create a new subscription plan with permissions and limits
 *     tags: [Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - allowedPermissions
 *               - limits
 *             properties:
 *               name:
 *                 type: string
 *                 example: Professional Plan
 *               description:
 *                 type: string
 *                 example: Full access with advanced features
 *               price:
 *                 type: number
 *                 example: 99.99
 *               billingPeriod:
 *                 type: string
 *                 example: monthly
 *               allowedPermissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: array
 *                   items:
 *                     type: string
 *                 example:
 *                   user: ['create', 'read', 'update', 'delete']
 *                   role: ['create', 'read', 'update']
 *               limits:
 *                 type: object
 *                 additionalProperties:
 *                   type: number
 *                 example:
 *                   maxUsers: 100
 *                   maxRoles: 20
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Plan created successfully
 *   get:
 *     summary: List all plans (Super Admin only)
 *     description: Get a list of all subscription plans
 *     tags: [Plans]
 *     responses:
 *       200:
 *         description: List of plans
 */
// Routes
router.post(
  '/',
  validate(createPlanSchema),
  (req, res, next) => {
    controller.create(req as any, res).catch(next);
  }
);

router.get(
  '/',
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     summary: Get plan by ID (Super Admin only)
 *     description: Get details of a specific subscription plan
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Plan details
 *       404:
 *         description: Plan not found
 *   put:
 *     summary: Update a plan (Super Admin only)
 *     description: Update plan details including permissions and limits
 *     tags: [Plans]
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
 *               price:
 *                 type: number
 *               billingPeriod:
 *                 type: string
 *               allowedPermissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: array
 *                   items:
 *                     type: string
 *               limits:
 *                 type: object
 *                 additionalProperties:
 *                   type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *   delete:
 *     summary: Delete a plan (Super Admin only)
 *     description: Delete a subscription plan
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Plan deleted successfully
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
  validate(updatePlanSchema),
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

router.delete(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    controller.delete(req as any, res).catch(next);
  }
);

export default router;

