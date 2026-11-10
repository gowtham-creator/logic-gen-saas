import { Router, Request, Response, NextFunction } from 'express';
import { getAuthController } from '../config/dependencyInjection';
import { authMiddleware } from '../middleware/auth';
import { validate, schemas } from '../utils/validation';
import { TenantRequest, AuthenticatedRequest } from '../types/middleware.types';
import { generateCsrfToken } from '../middleware/csrf';
import Joi from 'joi';

const router = Router();
const controller = getAuthController();

// Validation schemas
const loginSchema = {
  body: Joi.object({
    email: schemas.email,
    password: Joi.string().required(), // Allow any password for login (validation happens on password reset)
    deviceInfo: Joi.object({
      clientDeviceId: Joi.string().optional(),
      screenWidth: Joi.number().optional(),
      screenHeight: Joi.number().optional(),
      timezone: Joi.string().optional(),
      colorDepth: Joi.number().optional(),
      hardwareConcurrency: Joi.number().optional(),
      platform: Joi.string().optional(),
      language: Joi.string().optional(),
      canvasFingerprint: Joi.string().optional(),
      webglFingerprint: Joi.string().optional(),
    }).optional(),
  }),
};

const refreshSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate a user and receive JWT tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', validate(loginSchema), (req: Request, res: Response) => controller.login(req as TenantRequest, res));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using a refresh token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', validate(refreshSchema), (req: Request, res: Response) => controller.refresh(req as TenantRequest, res));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logout the current user (invalidates refresh token)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post(
  '/logout',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.logout(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/auth/config:
 *   get:
 *     summary: Get authentication configuration (public)
 *     description: Get SSO and authentication configuration for the current client/tenant. Public endpoint for login page.
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Authentication configuration
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
 *                     ssoEnabled:
 *                       type: boolean
 *                       description: Whether SSO is enabled for this client
 *                     ssoProvider:
 *                       type: string
 *                       enum: [oidc, saml]
 *                       description: SSO provider type (only present if ssoEnabled is true)
 *                     mfaRequired:
 *                       type: boolean
 *                       description: Whether MFA is required for this client
 *                     allowPasswordLogin:
 *                       type: boolean
 *                       description: Whether password login is allowed
 */
// Public route - get auth configuration (for login page)
router.get('/config', (req: Request, res: Response) => controller.getAuthConfig(req as TenantRequest, res));

// OIDC routes
router.get('/oidc/authorize', (req: Request, res: Response) => controller.oidcAuthorize(req as TenantRequest, res));
router.get('/oidc/callback', (req: Request, res: Response) => controller.oidcCallback(req as TenantRequest, res));

/**
 * @swagger
 * /api/auth/me/permissions:
 *   get:
 *     summary: Get current user's permissions
 *     description: Get all permissions for the currently authenticated user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: User permissions
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
 *                       resource:
 *                         type: string
 *                       action:
 *                         type: string
 */
// Protected route - get current user info
router.get(
  '/me',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.getMe(req as AuthenticatedRequest, res)
);

// Protected route - get current user's permissions
router.get(
  '/me/permissions',
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.getMyPermissions(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password (authenticated users)
 *     description: Change password for authenticated users
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       401:
 *         description: Invalid current password
 */
// Protected route - reset password (for authenticated users)
const resetPasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: schemas.password,
  }),
};

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req as AuthenticatedRequest, res, next).catch(next);
  },
  (req: Request, res: Response) => controller.resetPassword(req as AuthenticatedRequest, res)
);

/**
 * @swagger
 * /api/auth/force-reset-password:
 *   post:
 *     summary: Force reset password (unauthenticated)
 *     description: Reset password for users who must reset their password. Does not require authentication but requires email and current password verification.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       401:
 *         description: Invalid credentials
 */
// Public route - force reset password (for users who must reset password)
// This doesn't require authentication, but requires email + current password verification
const forceResetPasswordSchema = {
  body: Joi.object({
    email: schemas.email,
    currentPassword: Joi.string().required(),
    newPassword: schemas.password,
  }),
};

router.post(
  '/force-reset-password',
  validate(forceResetPasswordSchema),
  (req: Request, res: Response) => controller.forceResetPassword(req as TenantRequest, res)
);

/**
 * @swagger
 * /api/auth/csrf-token:
 *   get:
 *     summary: Get CSRF token
 *     description: Get a CSRF token for state-changing operations. The token is generated from the csrf-secret cookie.
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: CSRF token
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
 *                     token:
 *                       type: string
 *                       example: abc123...
 */
// Public route - get CSRF token (GET requests are skipped by CSRF middleware)
router.get('/csrf-token', (req: Request, res: Response) => {
  try {
    const token = generateCsrfToken(req);
    res.json({
      success: true,
      data: { token },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_ERROR',
        message: 'Failed to generate CSRF token',
      },
    });
  }
});

export default router;

