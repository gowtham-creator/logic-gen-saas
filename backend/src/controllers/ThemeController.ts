import { Response } from 'express';
import { ThemeService } from '../services/ThemeService';
import { StorageService } from '../services/StorageService';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { AuthenticatedRequest, TenantRequest } from '../types/middleware.types';
import { getFileUrl, validateUploadedFile } from '../utils/fileUpload';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { asParam } from '../utils/params';

export class ThemeController {
  private themeService: ThemeService;
  private storageService: StorageService;

  constructor() {
    this.themeService = new ThemeService();
    this.storageService = new StorageService();
  }

  async getPublic(req: TenantRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      // Get merged theme (client theme overrides global theme) - public access
      const theme = await this.themeService.getMergedTheme(req.clientId, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      // Get merged theme (client theme overrides global theme)
      const theme = await this.themeService.getMergedTheme(req.clientId, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async getGlobal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const theme = await this.themeService.getOrCreateGlobalTheme(req);
      sendSuccess(res, theme);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const updateData = req.body;
      const theme = await this.themeService.updateTheme(req.clientId, updateData, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async updateGlobal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updateData = req.body;
      const theme = await this.themeService.updateTheme(null, updateData, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async reset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const theme = await this.themeService.resetTheme(req.clientId, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async resetGlobal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const theme = await this.themeService.resetTheme(null, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async uploadFavicon(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      if (!req.file || !req.file.buffer) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'No file uploaded', 400);
        return;
      }

      // Validate file content to prevent file type spoofing
      const validation = await validateUploadedFile(req.file.buffer, req.file.mimetype);
      if (!validation.valid) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, validation.error || 'Invalid file content', 400);
        return;
      }

      // Get storage engine
      const storageEngine = await this.storageService.getStorageEngine(req.clientId);
      if (!storageEngine) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
        return;
      }

      // Generate unique file name
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = `${req.clientId}/theme/favicon/${fileName}`;

      // Upload to storage
      const uploadResult = await storageEngine.uploadFile(
        filePath,
        req.file.buffer,
        {
          originalFileName: req.file.originalname,
          mimeType: req.file.mimetype,
          clientId: req.clientId,
        }
      );

      if (!uploadResult.success) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, uploadResult.error || 'Failed to upload file', 500);
        return;
      }

      const fileUrl = getFileUrl(filePath, 'favicon');
      const theme = await this.themeService.updateTheme(req.clientId, { faviconUrl: fileUrl }, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      logger.error('Favicon upload error:', error);
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async uploadGlobalFavicon(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file || !req.file.buffer) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'No file uploaded', 400);
        return;
      }

      // Validate file content to prevent file type spoofing
      const validation = await validateUploadedFile(req.file.buffer, req.file.mimetype);
      if (!validation.valid) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, validation.error || 'Invalid file content', 400);
        return;
      }

      // Get storage engine (use default for global theme)
      const storageEngine = await this.storageService.getStorageEngine();
      if (!storageEngine) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
        return;
      }

      // Generate unique file name
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = `global/theme/favicon/${fileName}`;

      // Upload to storage
      const uploadResult = await storageEngine.uploadFile(
        filePath,
        req.file.buffer,
        {
          originalFileName: req.file.originalname,
          mimeType: req.file.mimetype,
        }
      );

      if (!uploadResult.success) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, uploadResult.error || 'Failed to upload file', 500);
        return;
      }

      const fileUrl = getFileUrl(filePath, 'favicon');
      const theme = await this.themeService.updateTheme(null, { faviconUrl: fileUrl }, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      logger.error('Global favicon upload error:', error);
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async uploadLogo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      if (!req.file || !req.file.buffer) {
        // Provide more detailed error message
        const errorMsg = req.body?.error || 'No file uploaded. Please ensure you are uploading a valid image file (PNG, JPEG, GIF, SVG, or ICO) and the file size is under 5MB.';
        sendError(res, ERROR_CODES.VALIDATION_ERROR, errorMsg, 400);
        return;
      }

      // Validate file content to prevent file type spoofing
      const validation = await validateUploadedFile(req.file.buffer, req.file.mimetype);
      if (!validation.valid) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, validation.error || 'Invalid file content', 400);
        return;
      }

      // Get storage engine
      const storageEngine = await this.storageService.getStorageEngine(req.clientId);
      if (!storageEngine) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
        return;
      }

      // Generate unique file name
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = `${req.clientId}/theme/logo/${fileName}`;

      // Upload to storage
      const uploadResult = await storageEngine.uploadFile(
        filePath,
        req.file.buffer,
        {
          originalFileName: req.file.originalname,
          mimeType: req.file.mimetype,
          clientId: req.clientId,
        }
      );

      if (!uploadResult.success) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, uploadResult.error || 'Failed to upload file', 500);
        return;
      }

      const fileUrl = getFileUrl(filePath, 'logo');
      const theme = await this.themeService.updateTheme(req.clientId, { logoUrl: fileUrl }, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      logger.error('Logo upload error:', error);
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async uploadGlobalLogo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file || !req.file.buffer) {
        // Provide more detailed error message
        const errorMsg = req.body?.error || 'No file uploaded. Please ensure you are uploading a valid image file (PNG, JPEG, GIF, SVG, or ICO) and the file size is under 5MB.';
        sendError(res, ERROR_CODES.VALIDATION_ERROR, errorMsg, 400);
        return;
      }

      // Validate file content to prevent file type spoofing
      const validation = await validateUploadedFile(req.file.buffer, req.file.mimetype);
      if (!validation.valid) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, validation.error || 'Invalid file content', 400);
        return;
      }

      // Get storage engine (use default for global theme)
      const storageEngine = await this.storageService.getStorageEngine();
      if (!storageEngine) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
        return;
      }

      // Generate unique file name
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = `global/theme/logo/${fileName}`;

      // Upload to storage
      const uploadResult = await storageEngine.uploadFile(
        filePath,
        req.file.buffer,
        {
          originalFileName: req.file.originalname,
          mimeType: req.file.mimetype,
        }
      );

      if (!uploadResult.success) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, uploadResult.error || 'Failed to upload file', 500);
        return;
      }

      const fileUrl = getFileUrl(filePath, 'logo');
      const theme = await this.themeService.updateTheme(null, { logoUrl: fileUrl }, req);
      sendSuccess(res, theme);
    } catch (error: any) {
      logger.error('Global logo upload error:', error);
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async getFile(req: AuthenticatedRequest | TenantRequest, res: Response): Promise<void> {
    try {
      const filePath = asParam(req.params.filePath);
      if (!filePath) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'File path is required', 400);
        return;
      }

      // Decode the file path
      const decodedPath = decodeURIComponent(filePath);

      // Determine clientId from path or request
      let clientId: string | undefined = req.clientId;
      let storagePath = decodedPath;

      // If path starts with "global/", use default storage engine
      if (decodedPath.startsWith('global/')) {
        clientId = undefined;
        // storagePath is already correct (global/theme/...)
      } else if (decodedPath.includes('/')) {
        // Path contains slashes, so it should be the full storage path (e.g., clientId/theme/favicon/filename.ext)
        // Extract clientId from the path if not in request (for public access)
        if (!clientId) {
          const pathParts = decodedPath.split('/');
          if (pathParts.length > 0) {
            // First part should be the clientId (UUID format)
            const potentialClientId = pathParts[0];
            // Validate it looks like a UUID
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialClientId)) {
              clientId = potentialClientId;
            }
          }
        }
        // storagePath is already the full path
      } else {
        // Path doesn't contain slashes, so it's just a filename
        // Need clientId from request to construct full path
        if (!clientId) {
          sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
          return;
        }
        // This case shouldn't happen with our current implementation, but handle it for safety
        storagePath = `${clientId}/theme/${decodedPath}`;
      }

      const storageEngine = await this.storageService.getStorageEngine(clientId);
      if (!storageEngine) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
        return;
      }

      const fileContent = await storageEngine.downloadFile(storagePath);
      if (!fileContent) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'File not found in storage', 404);
        return;
      }

      // Determine MIME type from file extension
      const ext = path.extname(decodedPath).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.send(fileContent);
    } catch (error: any) {
      logger.error('Theme file download error:', error);
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }
}

