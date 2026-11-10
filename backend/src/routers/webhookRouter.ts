import { Router, Request, Response, NextFunction } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { validate } from '../utils/validation';
import { schemas } from '../utils/validation';
import { AuthenticatedRequest } from '../types/middleware.types';
import Joi from 'joi';
import { WebhookEventType } from '../entities/Webhook';

const router = Router();
const controller = new WebhookController();

// Validation schemas
const createWebhookSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    url: Joi.string().uri().required(),
    events: Joi.array()
      .items(Joi.string().valid(...[
        'user.created',
        'user.updated',
        'user.deleted',
        'user.activated',
        'user.deactivated',
        'role.created',
        'role.updated',
        'role.deleted',
        'role.permissions.updated',
        'apiKey.created',
        'apiKey.updated',
        'apiKey.revoked',
        'apiKey.deleted',
        'permission.created',
        'permission.updated',
        'auditLog.created',
      ] as WebhookEventType[]))
      .min(1)
      .required(),
    secret: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    maxRetries: Joi.number().integer().min(0).max(10).optional(),
    timeoutMs: Joi.number().integer().min(1000).max(60000).optional(),
    acknowledgementRequired: Joi.boolean().optional(),
    acknowledgementTimeoutMs: Joi.number().integer().min(5000).max(300000).optional(),
    headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  }),
};

const updateWebhookSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    url: Joi.string().uri().optional(),
    events: Joi.array()
      .items(Joi.string().valid(...[
        'user.created',
        'user.updated',
        'user.deleted',
        'user.activated',
        'user.deactivated',
        'role.created',
        'role.updated',
        'role.deleted',
        'role.permissions.updated',
        'apiKey.created',
        'apiKey.updated',
        'apiKey.revoked',
        'apiKey.deleted',
        'permission.created',
        'permission.updated',
        'auditLog.created',
      ] as WebhookEventType[]))
      .min(1)
      .optional(),
    secret: Joi.string().allow(null).optional(),
    isActive: Joi.boolean().optional(),
    maxRetries: Joi.number().integer().min(0).max(10).optional(),
    timeoutMs: Joi.number().integer().min(1000).max(60000).optional(),
    acknowledgementRequired: Joi.boolean().optional(),
    acknowledgementTimeoutMs: Joi.number().integer().min(5000).max(300000).optional(),
    headers: Joi.object().pattern(Joi.string(), Joi.string()).allow(null).optional(),
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

const eventIdParamSchema = {
  params: Joi.object({
    eventId: schemas.uuid,
  }),
};

/**
 * @swagger
 * /api/webhooks:
 *   post:
 *     summary: Create a new webhook
 *     description: Create a webhook configuration for receiving events
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *               - events
 *             properties:
 *               name:
 *                 type: string
 *                 example: User Events Webhook
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/webhooks
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [user.created, user.updated, user.deleted, role.created, role.updated]
 *                 example: [user.created, user.updated]
 *               secret:
 *                 type: string
 *                 description: Secret for HMAC signature verification
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               maxRetries:
 *                 type: integer
 *                 default: 3
 *               timeoutMs:
 *                 type: integer
 *                 default: 5000
 *               headers:
 *                 type: object
 *                 description: Custom headers to include in webhook requests
 *     responses:
 *       201:
 *         description: Webhook created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('webhook', 'create')(req as AuthenticatedRequest, res, next).catch(next);
  },
  validate(createWebhookSchema),
  (req, res) => controller.create(req as any, res)
);

/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     summary: List all webhooks
 *     description: Get all webhooks for the current client
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 */
router.get(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('webhook', 'read')(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req, res) => controller.list(req as any, res)
);

/**
 * @swagger
 * /api/webhooks/{id}:
 *   get:
 *     summary: Get webhook by ID
 *     description: Get webhook details
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Webhook details
 *       404:
 *         description: Webhook not found
 */
router.get(
  '/:id',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('webhook', 'read')(req as AuthenticatedRequest, res, next).catch(next);
  },
  validate(idParamSchema),
  (req, res) => controller.get(req as any, res)
);

/**
 * @swagger
 * /api/webhooks/{id}:
 *   put:
 *     summary: Update webhook
 *     description: Update webhook configuration
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
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
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               secret:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook updated successfully
 *       404:
 *         description: Webhook not found
 */
router.put(
  '/:id',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('webhook', 'update')(req as AuthenticatedRequest, res, next).catch(next);
  },
  validate(updateWebhookSchema),
  (req, res) => controller.update(req as any, res)
);

/**
 * @swagger
 * /api/webhooks/{id}:
 *   delete:
 *     summary: Delete webhook
 *     description: Delete a webhook configuration
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Webhook deleted successfully
 *       404:
 *         description: Webhook not found
 */
router.delete(
  '/:id',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('webhook', 'delete')(req as AuthenticatedRequest, res, next).catch(next);
  },
  validate(idParamSchema),
  (req, res) => controller.delete(req as any, res)
);

/**
 * @swagger
 * /api/webhooks/{id}/events:
 *   get:
 *     summary: Get webhook delivery events
 *     description: Get delivery history for a webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of webhook events
 */
router.get(
  '/:id/events',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('webhook', 'read')(req as AuthenticatedRequest, res, next).catch(next);
  },
  validate(idParamSchema),
  (req, res) => controller.getEvents(req as any, res)
);

/**
 * @swagger
 * /api/webhooks/events/{eventId}/retry:
 *   post:
 *     summary: Retry failed webhook delivery
 *     description: Retry a failed webhook event delivery
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Retry initiated
 *       404:
 *         description: Event not found
 */
router.post(
  '/events/:eventId/retry',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as any, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    rbacMiddleware('webhook', 'update')(req as AuthenticatedRequest, res, next).catch(next);
  },
  validate(eventIdParamSchema),
  (req, res) => controller.retryEvent(req as any, res)
);

/**
 * @swagger
 * /api/webhooks/events/{eventId}/acknowledge:
 *   post:
 *     summary: Acknowledge webhook event
 *     description: Acknowledge receipt of a webhook event (public endpoint, no auth required)
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: Acknowledgement status (e.g., "processed", "accepted", "rejected")
 *     responses:
 *       200:
 *         description: Acknowledgement received
 *       404:
 *         description: Event not found
 */
router.post(
  '/events/:eventId/acknowledge',
  validate({
    params: Joi.object({
      eventId: schemas.uuid,
    }),
    body: Joi.object({
      status: Joi.string().optional(),
    }).optional(),
  }),
  (req, res) => controller.acknowledgeEvent(req, res)
);

export default router;

