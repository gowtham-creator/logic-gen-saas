import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ThemeController } from '../controllers/ThemeController';
import { authMiddleware } from '../middleware/auth';
import { superAdminMiddleware } from '../middleware/superAdmin';
import { subdomainMiddleware } from '../middleware/subdomain';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate } from '../utils/validation';
import { uploadFavicon, uploadLogo } from '../utils/fileUpload';
import { sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { TenantRequest } from '../types/middleware.types';
import Joi from 'joi';

const router = Router();
const controller = new ThemeController();

// Public route for theme (used on login screen)
// Note: subdomainMiddleware is already applied globally in index.ts, but we need it here
// because the auth middleware below would block it otherwise
router.get(
  '/public',
  subdomainMiddleware,
  (req: Request, res: Response, next: NextFunction) => {
    controller.getPublic(req as TenantRequest, res).catch(next);
  }
);

/**
 * @swagger
 * /api/theme/files/{filePath}:
 *   get:
 *     summary: Get theme file (favicon or logo) - Public access
 *     description: Download a theme file (favicon or logo) from storage. Public access for login pages.
 *     tags: [Theme]
 *     parameters:
 *       - in: path
 *         name: filePath
 *         required: true
 *         schema:
 *           type: string
 *         description: Encoded file path in storage (e.g., clientId/theme/favicon/filename.ext or global/theme/logo/filename.ext)
 *     responses:
 *       200:
 *         description: File content
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 */
// File serving route - public access for theme files (needed for login page and public pages)
// Note: filePath is URL-encoded, so we use a single parameter and decode it in the controller
router.get(
  '/files/:filePath',
  subdomainMiddleware,
  (req: Request, res: Response, next: NextFunction) => {
    controller.getFile(req as any, res).catch(next);
  }
);

// All other routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const updateThemeSchema = {
  body: Joi.object({
    colors: Joi.object({
      primary: Joi.string().optional(),
      secondary: Joi.string().optional(),
      accent: Joi.string().optional(),
      background: Joi.string().optional(),
      text: Joi.string().optional(),
    }).optional(),
    cssVariables: Joi.object().optional(),
    faviconUrl: Joi.string().uri().allow('').optional(),
    logoUrl: Joi.string().uri().allow('').optional(),
    themeName: Joi.string().optional(),
  }),
};

/**
 * @swagger
 * /api/theme:
 *   get:
 *     summary: Get current client theme
 *     description: Get the merged theme for the current client (client theme overrides global theme)
 *     tags: [Theme]
 *     responses:
 *       200:
 *         description: Theme configuration
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     clientId:
 *                       type: string
 *                       format: uuid
 *                     colors:
 *                       type: object
 *                       properties:
 *                         primary:
 *                           type: string
 *                         secondary:
 *                           type: string
 *                         accent:
 *                           type: string
 *                         background:
 *                           type: string
 *                         text:
 *                           type: string
 *                     themeName:
 *                       type: string
 *                     faviconUrl:
 *                       type: string
 *                       nullable: true
 *                     logoUrl:
 *                       type: string
 *                       nullable: true
 *   put:
 *     summary: Update client theme
 *     description: Update theme settings for the current client
 *     tags: [Theme]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               colors:
 *                 type: object
 *                 properties:
 *                   primary:
 *                     type: string
 *                   secondary:
 *                     type: string
 *                   accent:
 *                     type: string
 *                   background:
 *                     type: string
 *                   text:
 *                     type: string
 *               themeName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Theme updated successfully
 *   post:
 *     summary: Reset theme to default
 *     description: Reset the client theme to default values
 *     tags: [Theme]
 *     responses:
 *       200:
 *         description: Theme reset successfully
 */
// Routes
router.get(
  '/',
  (req, res, next) => {
    controller.get(req as any, res).catch(next);
  }
);

router.put(
  '/',
  validate(updateThemeSchema),
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

router.post(
  '/reset',
  (req, res, next) => {
    controller.reset(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/theme/upload/favicon:
 *   post:
 *     summary: Upload favicon
 *     description: Upload a favicon for the client theme (max 2MB, PNG/JPEG/GIF/SVG/ICO)
 *     tags: [Theme]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - favicon
 *             properties:
 *               favicon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Favicon uploaded successfully
 *       400:
 *         description: Invalid file or file too large
 * /api/theme/upload/logo:
 *   post:
 *     summary: Upload logo
 *     description: Upload a logo for the client theme (max 5MB, PNG/JPEG/GIF/SVG/ICO)
 *     tags: [Theme]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *       400:
 *         description: Invalid file or file too large
 */
router.post(
  '/upload/favicon',
  (req, res, next) => {
    uploadFavicon.single('favicon')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file size, file type, etc.)
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'File size exceeds the maximum limit of 2MB', 400);
          }
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
        }
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message || 'File upload error', 400);
      }
      next();
    });
  },
  (req, res, next) => {
    controller.uploadFavicon(req as any, res).catch(next);
  }
);

router.post(
  '/upload/logo',
  (req, res, next) => {
    uploadLogo.single('logo')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file size, file type, etc.)
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'File size exceeds the maximum limit of 5MB', 400);
          }
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
        }
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message || 'File upload error', 400);
      }
      next();
    });
  },
  (req, res, next) => {
    controller.uploadLogo(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/theme/global:
 *   get:
 *     summary: Get global theme (Super Admin only)
 *     description: Get the global theme settings that serve as defaults for all clients
 *     tags: [Theme]
 *     responses:
 *       200:
 *         description: Global theme configuration
 *   put:
 *     summary: Update global theme (Super Admin only)
 *     description: Update global theme settings that serve as defaults for all clients
 *     tags: [Theme]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               colors:
 *                 type: object
 *               themeName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Global theme updated successfully
 *   post:
 *     summary: Reset global theme (Super Admin only)
 *     description: Reset the global theme to default values
 *     tags: [Theme]
 *     responses:
 *       200:
 *         description: Global theme reset successfully
 */
// Global theme routes (super admin only)
router.get(
  '/global',
  superAdminMiddleware,
  (req, res, next) => {
    controller.getGlobal(req as any, res).catch(next);
  }
);

router.put(
  '/global',
  superAdminMiddleware,
  validate(updateThemeSchema),
  (req, res, next) => {
    controller.updateGlobal(req as any, res).catch(next);
  }
);

router.post(
  '/global/reset',
  superAdminMiddleware,
  (req, res, next) => {
    controller.resetGlobal(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/theme/global/upload/favicon:
 *   post:
 *     summary: Upload global favicon (Super Admin only)
 *     description: Upload a favicon for the global theme (max 2MB, PNG/JPEG/GIF/SVG/ICO)
 *     tags: [Theme]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - favicon
 *             properties:
 *               favicon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Global favicon uploaded successfully
 *       400:
 *         description: Invalid file or file too large
 * /api/theme/global/upload/logo:
 *   post:
 *     summary: Upload global logo (Super Admin only)
 *     description: Upload a logo for the global theme (max 5MB, PNG/JPEG/GIF/SVG/ICO)
 *     tags: [Theme]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Global logo uploaded successfully
 *       400:
 *         description: Invalid file or file too large
 */
router.post(
  '/global/upload/favicon',
  superAdminMiddleware,
  (req, res, next) => {
    uploadFavicon.single('favicon')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file size, file type, etc.)
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'File size exceeds the maximum limit of 2MB', 400);
          }
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
        }
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message || 'File upload error', 400);
      }
      next();
    });
  },
  (req, res, next) => {
    controller.uploadGlobalFavicon(req as any, res).catch(next);
  }
);

router.post(
  '/global/upload/logo',
  superAdminMiddleware,
  (req, res, next) => {
    uploadLogo.single('logo')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file size, file type, etc.)
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'File size exceeds the maximum limit of 5MB', 400);
          }
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
        }
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, err.message || 'File upload error', 400);
      }
      next();
    });
  },
  (req, res, next) => {
    controller.uploadGlobalLogo(req as any, res).catch(next);
  }
);

export default router;

