import { Router, Request, Response, NextFunction } from 'express';
import { ApiKeyController } from '../controllers/ApiKeyController';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new ApiKeyController();

// All routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const createApiKeySchema = {
  body: Joi.object({
    name: Joi.string().required(),
    scopes: Joi.array().items(Joi.string()).required(),
    allowedEndpoints: Joi.array().items(Joi.string()).required(),
    expiresAt: Joi.date().optional(),
    rateLimitPerMinute: Joi.number().integer().min(0).optional(),
  }),
};

const updateApiKeySchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    scopes: Joi.array().items(Joi.string()).optional(),
    allowedEndpoints: Joi.array().items(Joi.string()).optional(),
    expiresAt: Joi.date().allow(null).optional(),
    rateLimitPerMinute: Joi.number().integer().min(0).optional(),
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
 * /api/api-keys:
 *   post:
 *     summary: Create a new API key
 *     description: Create a new API key with specified scopes, endpoints, and rate limits
 *     tags: [API Keys]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - scopes
 *               - allowedEndpoints
 *             properties:
 *               name:
 *                 type: string
 *                 example: Production API Key
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['users:read', 'users:write']
 *               allowedEndpoints:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['/api/users', '/api/roles']
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               rateLimitPerMinute:
 *                 type: integer
 *                 minimum: 0
 *                 example: 100
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  validate(createApiKeySchema),
  (req, res, next) => {
    rbacMiddleware('api-key', 'create')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.create(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: List all API keys
 *     description: Get a list of all API keys for the current client
 *     tags: [API Keys]
 *     responses:
 *       200:
 *         description: List of API keys
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
 *                     $ref: '#/components/schemas/ApiKey'
 */
router.get(
  '/',
  (req, res, next) => {
    rbacMiddleware('api-key', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/api-keys/{id}:
 *   get:
 *     summary: Get API key by ID
 *     description: Get details of a specific API key
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: 123e4567-e89b-12d3-a456-426614174000
 *     responses:
 *       200:
 *         description: API key details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       404:
 *         description: API key not found
 */
router.get(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('api-key', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.get(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/api-keys/{id}:
 *   put:
 *     summary: Update an API key
 *     description: Update API key details including scopes, endpoints, and rate limits
 *     tags: [API Keys]
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
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedEndpoints:
 *                 type: array
 *                 items:
 *                   type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               rateLimitPerMinute:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: API key updated successfully
 *       404:
 *         description: API key not found
 */
router.put(
  '/:id',
  validate(updateApiKeySchema),
  (req, res, next) => {
    rbacMiddleware('api-key', 'update')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/api-keys/{id}/revoke:
 *   put:
 *     summary: Revoke an API key
 *     description: Revoke an API key (marks it as inactive but doesn't delete it)
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *       404:
 *         description: API key not found
 */
router.put(
  '/:id/revoke',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('api-key', 'update')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.revoke(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     description: Permanently delete an API key
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *       404:
 *         description: API key not found
 */
router.delete(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('api-key', 'delete')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.delete(req as any, res).catch(next);
  }
);

export default router;

