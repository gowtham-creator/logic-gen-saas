import { Router, Request, Response, NextFunction } from 'express';
import { AuditLogController } from '../controllers/AuditLogController';
import { authMiddleware } from '../middleware/auth';
import { optionalAuthMiddleware } from '../middleware/optionalAuth';
import { rbacMiddleware } from '../middleware/rbac';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const logUnauthorizedAccessSchema = {
  body: Joi.object({
    attemptedPath: Joi.string().optional(),
    resource: Joi.string().optional(),
  }),
};

const router = Router();
const controller = new AuditLogController();

// Special route for logging unauthorized access - allows optional auth (no RBAC required)
// This route should be accessible even if user is not fully authenticated
router.post(
  '/unauthorized-access',
  validate(logUnauthorizedAccessSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    // Use optional auth to try to get user info, but don't fail if it can't
    await optionalAuthMiddleware(req as any, res, () => {
      controller.logUnauthorizedAccess(req as any, res).catch(next);
    });
  }
);

// Apply auth middleware to all other routes
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Apply RBAC middleware - require audit-log:read permission
router.use((req: Request, res: Response, next: NextFunction) => {
  rbacMiddleware('audit-log', 'read')(req as any, res, next).catch(next);
});

const listAuditLogsSchema = {
  query: Joi.object({
    userId: schemas.uuid.optional(),
    action: Joi.string().optional(),
    resourceType: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: List audit logs
 *     description: Get a paginated list of audit logs with optional filters
 *     tags: [Audit Logs]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action (create, update, delete, etc.)
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *         description: Filter by resource type (user, role, etc.)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs until this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Paginated list of audit logs
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
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */
// List audit logs with filters
router.get(
  '/',
  validate(listAuditLogsSchema),
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/audit-logs/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     description: Get details of a specific audit log entry
 *     tags: [Audit Logs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Audit log details
 *       404:
 *         description: Audit log not found
 */
// Get single audit log
router.get(
  '/:id',
  validate({
    params: Joi.object({
      id: schemas.uuid,
    }),
  }),
  (req, res, next) => {
    controller.get(req as any, res).catch(next);
  }
);

export default router;

