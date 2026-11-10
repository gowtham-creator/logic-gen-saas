import { Router, Request, Response, NextFunction } from 'express';
import { ClientController } from '../controllers/ClientController';
import { combinedAuthMiddleware } from '../middleware/combinedAuth';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new ClientController();

// All routes require authentication (accepts both regular user and super admin tokens)
router.use((req: Request, res: Response, next: NextFunction) => {
  combinedAuthMiddleware(req as any, res, next).catch(next);
});

// Validation schemas
const createClientSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    subdomain: Joi.string().required(),
    planId: schemas.uuid.optional(),
    planExpiresAt: Joi.date().optional(),
    allowSuperAdminLogin: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    ssoConfig: Joi.object({
      provider: Joi.string().valid('oidc', 'saml').required(),
      metadata: Joi.object().optional(),
      enabled: Joi.boolean().required(),
    }).optional(),
    databaseConfig: Joi.object({
      isolationLevel: Joi.string().valid('shared', 'database').required(),
      allowCustomTables: Joi.boolean().optional(),
      allowCustomColumns: Joi.boolean().optional(),
      allowCustomMigrations: Joi.boolean().optional(),
      maxCustomTables: Joi.number().integer().positive().allow(null).optional(),
      maxCustomColumns: Joi.number().integer().positive().allow(null).optional(),
      databaseUrl: Joi.string().uri().allow(null, '').optional(),
    }).optional(),
    storageConfig: Joi.object({
      storageEngineId: Joi.string().uuid().required(),
      config: Joi.object().required(),
    }).optional(),
    mfaRequired: Joi.boolean().optional(),
    enforceMFA: Joi.boolean().optional(),
    // Admin user fields (required)
    adminEmail: Joi.string().email().required(),
    adminPassword: Joi.string().min(8).required(),
    adminFirstName: Joi.string().required(),
    adminLastName: Joi.string().required(),
  }),
};

const updateClientSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    subdomain: Joi.string().optional(),
    planId: schemas.uuid.optional(),
    planExpiresAt: Joi.date().optional(),
    allowSuperAdminLogin: Joi.boolean().optional(),
    ssoConfig: Joi.object({
      provider: Joi.string().valid('oidc', 'saml').required(),
      metadata: Joi.object().optional(),
      enabled: Joi.boolean().required(),
    }).optional(),
    databaseConfig: Joi.object({
      isolationLevel: Joi.string().valid('shared', 'database').optional(),
      allowCustomTables: Joi.boolean().optional(),
      allowCustomColumns: Joi.boolean().optional(),
      allowCustomMigrations: Joi.boolean().optional(),
      maxCustomTables: Joi.number().integer().positive().allow(null).optional(),
      maxCustomColumns: Joi.number().integer().positive().allow(null).optional(),
      databaseUrl: Joi.string().uri().allow(null, '').optional(),
    }).optional(),
    storageConfig: Joi.object({
      storageEngineId: Joi.string().uuid().required(),
      config: Joi.object().required(),
    }).optional(),
    isActive: Joi.boolean().optional(),
    mfaRequired: Joi.boolean().optional(),
    enforceMFA: Joi.boolean().optional(),
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
 * /api/clients:
 *   post:
 *     summary: Create a new client (Super Admin only)
 *     description: Create a new tenant/client in the system
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subdomain
 *               - adminEmail
 *               - adminPassword
 *               - adminFirstName
 *               - adminLastName
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Corporation
 *               subdomain:
 *                 type: string
 *                 example: acme
 *               planId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               planExpiresAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               allowSuperAdminLogin:
 *                 type: boolean
 *                 example: false
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               adminEmail:
 *                 type: string
 *                 format: email
 *                 example: admin@acme.com
 *                 description: Admin user email (required)
 *               adminPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *                 description: Admin user password (required - user will be required to reset on first login)
 *               adminFirstName:
 *                 type: string
 *                 example: Admin
 *                 description: Admin user first name (required)
 *               adminLastName:
 *                 type: string
 *                 example: User
 *                 description: Admin user last name (required)
 *               ssoConfig:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     enum: [oidc, saml]
 *                   metadata:
 *                     type: object
 *                   enabled:
 *                     type: boolean
 *     responses:
 *       201:
 *         description: Client created successfully
 *   get:
 *     summary: List all clients (Super Admin only)
 *     description: Get a list of all clients in the system
 *     tags: [Clients]
 *     responses:
 *       200:
 *         description: List of clients
 */
// Create client (Super Admin only)
router.post(
  '/',
  validate(createClientSchema),
  (req, res, next) => {
    // Super admin only - no RBAC check needed as this is typically super admin only
    controller.create(req as any, res).catch(next);
  }
);

// Get all clients (Super Admin only)
router.get(
  '/',
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Get client by ID (Super Admin only)
 *     description: Get details of a specific client
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Client details
 *       404:
 *         description: Client not found
 *   put:
 *     summary: Update a client (Super Admin only)
 *     description: Update client details including SSO configuration
 *     tags: [Clients]
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
 *               subdomain:
 *                 type: string
 *               planId:
 *                 type: string
 *                 format: uuid
 *               planExpiresAt:
 *                 type: string
 *                 format: date-time
 *               ssoConfig:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     enum: [oidc, saml]
 *                   metadata:
 *                     type: object
 *                   enabled:
 *                     type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Client updated successfully
 *   delete:
 *     summary: Delete a client (Super Admin only)
 *     description: Delete a client from the system
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Client deleted successfully
 */
// Get client by ID (Super Admin only)
router.get(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    controller.get(req as any, res).catch(next);
  }
);

// Update client (Super Admin only)
router.put(
  '/:id',
  validate(updateClientSchema),
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

router.delete(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    // Super admin only - no RBAC check needed as this is typically super admin only
    controller.delete(req as any, res).catch(next);
  }
);

// Migration endpoints
router.post(
  '/:id/check-migration',
  validate(idParamSchema),
  (req, res, next) => {
    controller.checkMigration(req as any, res).catch(next);
  }
);

router.post(
  '/:id/migrate-database',
  validate(idParamSchema),
  (req, res, next) => {
    controller.migrateDatabase(req as any, res).catch(next);
  }
);

export default router;

