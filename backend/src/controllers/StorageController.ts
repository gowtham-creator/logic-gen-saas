import { Request, Response } from 'express';
import { StorageService } from '../services/StorageService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { asParam } from '../utils/params';

export class StorageController {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
  }

  /**
   * Get all available storage engines
   */
  async getStorageEngines(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const engines = await this.storageService.getStorageEngines();
      sendSuccess(res, engines);
    } catch (error: any) {
      sendError(res, 'GET_STORAGE_ENGINES_ERROR', error.message, 500);
    }
  }

  /**
   * Get default storage configuration
   */
  async getDefaultStorageConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const config = await this.storageService.getDefaultStorageConfig();
      
      if (!config) {
        sendSuccess(res, null);
        return;
      }

      // Sanitize storage config before sending response (remove sensitive fields)
      const { getStorageConfigEncryptionService } = await import('../services/StorageConfigEncryptionService');
      const encryptionService = getStorageConfigEncryptionService();
      const sanitizedConfig = {
        ...config,
        config: encryptionService.sanitizeStorageConfig(
          config.config,
          config.storageEngine?.type || 'local'
        ),
      };
      
      sendSuccess(res, sanitizedConfig);
    } catch (error: any) {
      sendError(res, 'GET_DEFAULT_STORAGE_CONFIG_ERROR', error.message, 500);
    }
  }

  /**
   * Set default storage configuration
   */
  async setDefaultStorageConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { storageEngineId, config } = req.body;

      if (!storageEngineId || !config) {
        sendError(res, 'VALIDATION_ERROR', 'storageEngineId and config are required', 400);
        return;
      }

      const storageConfig = await this.storageService.setDefaultStorageConfig(storageEngineId, config);
      
      // Sanitize storage config before sending response (remove sensitive fields)
      const { getStorageConfigEncryptionService } = await import('../services/StorageConfigEncryptionService');
      const encryptionService = getStorageConfigEncryptionService();
      const sanitizedConfig = {
        ...storageConfig,
        config: encryptionService.sanitizeStorageConfig(
          storageConfig.config,
          storageConfig.storageEngine?.type || 'local'
        ),
      };
      
      sendSuccess(res, sanitizedConfig);
    } catch (error: any) {
      sendError(res, 'SET_DEFAULT_STORAGE_CONFIG_ERROR', error.message, 400);
    }
  }

  /**
   * Get client storage configuration
   */
  async getClientStorageConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = asParam(req.params.clientId);
      const config = await this.storageService.getClientStorageConfig(clientId);
      
      if (!config) {
        sendSuccess(res, null);
        return;
      }

      // Sanitize storage config before sending response (remove sensitive fields)
      const { getStorageConfigEncryptionService } = await import('../services/StorageConfigEncryptionService');
      const encryptionService = getStorageConfigEncryptionService();
      const sanitizedConfig = {
        ...config,
        config: encryptionService.sanitizeStorageConfig(
          config.config,
          config.storageEngine?.type || 'local'
        ),
      };
      
      sendSuccess(res, sanitizedConfig);
    } catch (error: any) {
      sendError(res, 'GET_CLIENT_STORAGE_CONFIG_ERROR', error.message, 500);
    }
  }

  /**
   * Set client storage configuration
   */
  async setClientStorageConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = asParam(req.params.clientId);
      const { storageEngineId, config } = req.body;

      if (!storageEngineId || !config) {
        sendError(res, 'VALIDATION_ERROR', 'storageEngineId and config are required', 400);
        return;
      }

      const storageConfig = await this.storageService.setClientStorageConfig(
        clientId,
        storageEngineId,
        config
      );
      
      // Sanitize storage config before sending response (remove sensitive fields)
      const { getStorageConfigEncryptionService } = await import('../services/StorageConfigEncryptionService');
      const encryptionService = getStorageConfigEncryptionService();
      const sanitizedConfig = {
        ...storageConfig,
        config: encryptionService.sanitizeStorageConfig(
          storageConfig.config,
          storageConfig.storageEngine?.type || 'local'
        ),
      };
      
      sendSuccess(res, sanitizedConfig);
    } catch (error: any) {
      sendError(res, 'SET_CLIENT_STORAGE_CONFIG_ERROR', error.message, 400);
    }
  }
}

