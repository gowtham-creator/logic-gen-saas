import { Router, Request, Response, NextFunction } from 'express';
import { WorkflowController } from '../controllers/WorkflowController';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import { ELEMENT_IDS } from '../constants/permissions';
import Joi from 'joi';
import multer from 'multer';

const router = Router();
const controller = new WorkflowController();

// Configure multer for workflow file uploads (memory storage for direct upload to storage service)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only PDF, DOC, and DOCX strictly
    const allowedMimeTypes = [
      // PDF
      'application/pdf',
      // Microsoft Word (DOC)
      'application/msword',
      // Microsoft Word (DOCX)
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    // Check file extension as fallback
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Only PDF, DOC, and DOCX files are allowed.`));
    }
  },
});

// All routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const createWorkflowSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional().allow('', null),
    isActive: Joi.boolean().optional(),
  }),
};

const updateWorkflowSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().optional().allow('', null),
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

const workflowIdsSchema = {
  query: Joi.object({
    workflowIds: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).required(),
  }),
};

/**
 * @swagger
 * /api/workflows:
 *   get:
 *     summary: List all workflows
 *     description: Get a list of all workflows for the current client
 *     tags: [Workflows]
 *     responses:
 *       200:
 *         description: List of workflows
 *   post:
 *     summary: Create a new workflow
 *     description: Create a new workflow
 *     tags: [Workflows]
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
 *               description:
 *                 type: string
 */
router.post(
  '/',
  validate(createWorkflowSchema),
  (req, res, next) => {
    rbacMiddleware('workflow', 'create')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.create(req as any, res).catch(next);
  }
);

router.get(
  '/',
  (req, res, next) => {
    rbacMiddleware('workflow', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.list(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/workflows/files:
 *   get:
 *     summary: Get files for workflows
 *     description: Get files for one or more workflows
 *     tags: [Workflows]
 *     parameters:
 *       - in: query
 *         name: workflowIds
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated workflow IDs
 */
router.get(
  '/files',
  validate(workflowIdsSchema),
  (req, res, next) => {
    rbacMiddleware('workflow', 'read', ELEMENT_IDS.BTN_VIEW_WORKFLOW_FILES)(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.getFiles(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/workflows/files/{fileId}:
 *   get:
 *     summary: Download workflow file
 *     tags: [Workflows]
 *   delete:
 *     summary: Delete workflow file
 *     tags: [Workflows]
 */
router.get(
  '/files/:fileId',
  validate({ params: Joi.object({ fileId: schemas.uuid }) }),
  (req, res, next) => {
    rbacMiddleware('workflow', 'read', ELEMENT_IDS.BTN_DOWNLOAD_WORKFLOW_FILE)(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.downloadFile(req as any, res).catch(next);
  }
);

router.delete(
  '/files/:fileId',
  validate({ params: Joi.object({ fileId: schemas.uuid }) }),
  (req, res, next) => {
    rbacMiddleware('workflow', 'delete', ELEMENT_IDS.BTN_DELETE_WORKFLOW_FILE)(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.deleteFile(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/workflows/{workflowId}/files:
 *   post:
 *     summary: Upload file to workflow
 *     tags: [Workflows]
 */
router.post(
  '/:workflowId/files',
  // Multer must run first to parse multipart/form-data before any body parsing
  (req, res, next) => {
    // Log request details before multer processes it
    const logger = require('../utils/logger').logger;
    logger.info('File upload request received (before multer)', {
      method: req.method,
      url: req.url,
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      workflowId: req.params.workflowId,
    });

    upload.array('files', 10)(req, res, (err) => {
      // Log after multer processes it
      const multerReq = req as any;
      const files = req.files as Express.Multer.File[];
      logger.info('File upload request processed by multer', {
        fileCount: files?.length || 0,
        hasFiles: !!files && files.length > 0,
        fileNames: files?.map(f => f.originalname) || [],
        totalSize: files?.reduce((sum, f) => sum + f.size, 0) || 0,
        bodyKeys: Object.keys(req.body || {}),
        body: req.body,
        error: err?.message,
        multerErrorCode: err instanceof multer.MulterError ? err.code : undefined,
      });

      if (err) {
        // Handle multer errors (file size, file type, etc.)
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'File size exceeds the maximum limit of 50MB' },
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Too many files. Maximum 10 files allowed per upload.' },
            });
          }
          return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: err.message },
          });
        }
        // Handle file type validation errors
        if (err.message && err.message.includes('File type not allowed')) {
          return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: err.message },
          });
        }
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.message || 'File upload error' },
        });
      }
      next();
    });
  },
  // Validate params after multer has parsed the request
  validate({ params: Joi.object({ workflowId: schemas.uuid }) }),
  (req, res, next) => {
    rbacMiddleware('workflow', 'create', ELEMENT_IDS.BTN_UPLOAD_WORKFLOW_FILE)(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.uploadFile(req as any, res).catch(next);
  }
);

/**
 * @swagger
 * /api/workflows/{id}:
 *   get:
 *     summary: Get workflow by ID
 *     tags: [Workflows]
 *   put:
 *     summary: Update a workflow
 *     tags: [Workflows]
 *   delete:
 *     summary: Delete a workflow
 *     tags: [Workflows]
 */
router.get(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('workflow', 'read')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.getById(req as any, res).catch(next);
  }
);

router.put(
  '/:id',
  validate(updateWorkflowSchema),
  (req, res, next) => {
    rbacMiddleware('workflow', 'update')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.update(req as any, res).catch(next);
  }
);

router.delete(
  '/:id',
  validate(idParamSchema),
  (req, res, next) => {
    rbacMiddleware('workflow', 'delete')(req as any, res, next).catch(next);
  },
  (req, res, next) => {
    controller.delete(req as any, res).catch(next);
  }
);

export default router;

