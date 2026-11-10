import { Router, Request, Response, NextFunction } from 'express';
import { getUserController } from '../config/dependencyInjection';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import { AuthenticatedRequest } from '../types/middleware.types';
import Joi from 'joi';

const router = Router();
const controller = getUserController();

// Email availability check (public endpoint, no auth required for onBlur validation)
router.get(
  '/check-email',
  (req: Request, res: Response, next: NextFunction) => {
    controller.checkEmailAvailability(req, res).catch(next);
  }
);

// All other routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const createUserSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    roleId: schemas.uuid.optional().allow(null),
    isActive: Joi.boolean().optional(),
    mustResetPassword: Joi.boolean().optional(),
  }),
};

const updateUserSchema = {
  body: Joi.object({
    // email is intentionally excluded - it cannot be updated
    password: Joi.string().min(8).optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    roleId: schemas.uuid.optional().allow(null),
    isActive: Joi.boolean().optional(),
    mustResetPassword: Joi.boolean().optional(),
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
 * /api/users:
 *   get:
 *     summary: List all users
 *     description: Get a list of all users for the current client
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
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
 *                     $ref: '#/components/schemas/User'
 *   post:
 *     summary: Create a new user
 *     description: Create a new user in the current client
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               roleId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               mustResetPassword:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 */
// Routes
router.post(
  '/',
  validate(createUserSchema),
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('user', 'create')(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    controller.create(req as AuthenticatedRequest, res).catch(next);
  }
);

router.get(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('user', 'read')(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    controller.list(req as AuthenticatedRequest, res).catch(next);
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Get details of a specific user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *   put:
 *     summary: Update a user
 *     description: Update user details. Email cannot be changed.
 *     tags: [Users]
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
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               roleId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *               mustResetPassword:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *   delete:
 *     summary: Delete a user
 *     description: Delete a user from the system
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.get(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('user', 'read')(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    controller.get(req as AuthenticatedRequest, res).catch(next);
  }
);

router.put(
  '/:id',
  validate(updateUserSchema),
  (req, res, next) => {
    rbacMiddleware('user', 'update')(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    controller.update(req as AuthenticatedRequest, res).catch(next);
  }
);

router.delete(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('user', 'delete')(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    controller.delete(req as AuthenticatedRequest, res).catch(next);
  }
);

export default router;

