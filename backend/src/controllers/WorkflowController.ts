import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { WorkflowService, CreateWorkflowDto, UpdateWorkflowDto } from '../services/WorkflowService';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { ERROR_CODES } from '../constants/errors';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { StorageService } from '../services/StorageService';
import { logger } from '../utils/logger';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { asParam } from '../utils/params';

export class WorkflowController {
  private workflowService: WorkflowService;
  private auditService: AuditService;
  private storageService: StorageService;

  constructor() {
    this.workflowService = new WorkflowService();
    this.auditService = new AuditService();
    this.storageService = new StorageService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateWorkflowDto = {
        ...req.body,
        clientId: req.clientId!,
      };

      const workflow = await this.workflowService.createWorkflow(data, req.userId!, req);

      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'workflow.created',
        resourceType: 'Workflow',
        resourceId: workflow.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      sendSuccess(res, workflow, 201);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const workflows = await this.workflowService.listWorkflows(req.clientId!, req);
      sendSuccess(res, workflows);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const workflow = await this.workflowService.getWorkflowById(id, req.clientId!, req);

      if (!workflow) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Workflow not found', 404);
        return;
      }

      sendSuccess(res, workflow);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const data: UpdateWorkflowDto = req.body;

      const workflow = await this.workflowService.updateWorkflow(
        id,
        data,
        req.userId!,
        req.clientId!,
        req
      );

      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'workflow.updated',
        resourceType: 'Workflow',
        resourceId: workflow.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      sendSuccess(res, workflow);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      await this.workflowService.deleteWorkflow(id, req.clientId!, req);

      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'workflow.deleted',
        resourceType: 'Workflow',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      sendSuccess(res, { message: 'Workflow deleted successfully' });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async uploadFile(req: AuthenticatedRequest & { files?: Express.Multer.File[] }, res: Response): Promise<void> {
    try {
      const workflowId = asParam(req.params.workflowId);
      const files = req.files as Express.Multer.File[];
      
      // Debug logging
      logger.info('File upload request received', {
        workflowId,
        fileCount: files?.length || 0,
        contentType: req.get('content-type'),
        bodyKeys: Object.keys(req.body || {}),
      });
      
      if (!files || files.length === 0) {
        logger.warn('No files in request', {
          workflowId,
          contentType: req.get('content-type'),
          body: req.body,
        });
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'No files provided', 400);
        return;
      }

      const storageEngine = await this.storageService.getStorageEngine(req.clientId!);
      
      if (!storageEngine) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
        return;
      }

      const clientId = req.clientId!;

      // Ensure client folder exists
      const clientFolderPath = `${clientId}/`;
      const clientFolderResult = await storageEngine.createFolder(clientFolderPath);
      if (!clientFolderResult.success) {
        logger.warn(`Failed to create client folder ${clientFolderPath}: ${clientFolderResult.error}`);
        // Continue anyway, as folder might already exist or storage might handle it automatically
      }

      // Ensure workflow folder exists
      const workflowFolderPath = `${clientId}/workflows/${workflowId}/`;
      const workflowFolderResult = await storageEngine.createFolder(workflowFolderPath);
      if (!workflowFolderResult.success) {
        logger.warn(`Failed to create workflow folder ${workflowFolderPath}: ${workflowFolderResult.error}`);
        // Continue anyway, as folder might already exist or storage might handle it automatically
      }

      // Process all files
      const uploadedFiles = [];
      const errors = [];

      for (const file of files) {
        try {
          // Generate unique file name
          const fileExtension = path.extname(file.originalname);
          const fileName = `${uuidv4()}${fileExtension}`;
          const filePath = `${clientId}/workflows/${workflowId}/${fileName}`;

          // Upload to storage
          const uploadResult = await storageEngine.uploadFile(
            filePath,
            file.buffer,
            {
              originalFileName: file.originalname,
              mimeType: file.mimetype,
              workflowId,
              clientId: clientId,
            }
          );

          if (!uploadResult.success) {
            errors.push({ fileName: file.originalname, error: uploadResult.error || 'Failed to upload file' });
            continue;
          }

          // Save file metadata to database
          const workflowFile = await this.workflowService.addFileToWorkflow(
            workflowId,
            {
              fileName,
              originalFileName: file.originalname,
              mimeType: file.mimetype,
              fileSize: file.size,
              filePath,
            },
            req.userId!,
            req.clientId!,
            req
          );

          uploadedFiles.push(workflowFile);

          await this.auditService.log({
            clientId: req.clientId!,
            userId: req.userId,
            action: 'workflow.file_uploaded',
            resourceType: 'WorkflowFile',
            resourceId: workflowFile.id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          }, req);
        } catch (fileError: any) {
          logger.error(`Error uploading file ${file.originalname}:`, fileError);
          errors.push({ fileName: file.originalname, error: fileError.message });
        }
      }

      if (uploadedFiles.length === 0) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, `Failed to upload all files. Errors: ${errors.map(e => `${e.fileName}: ${e.error}`).join(', ')}`, 500);
        return;
      }

      // Return uploaded files, with errors if any
      sendSuccess(res, {
        uploaded: uploadedFiles,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      }, 201);
    } catch (error: any) {
      logger.error('Workflow file upload error:', error);
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async deleteFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const fileId = asParam(req.params.fileId);
      await this.workflowService.deleteWorkflowFile(fileId, req.clientId!, req);

      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'workflow.file_deleted',
        resourceType: 'WorkflowFile',
        resourceId: fileId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);

      sendSuccess(res, { message: 'File deleted successfully' });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async getFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workflowIds } = req.query;
      
      if (!workflowIds) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'workflowIds parameter is required', 400);
        return;
      }

      const ids = Array.isArray(workflowIds) 
        ? workflowIds as string[]
        : (workflowIds as string).split(',').map(id => id.trim());

      const files = await this.workflowService.getWorkflowFiles(ids, req.clientId!, req);
      sendSuccess(res, files);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async downloadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const fileId = asParam(req.params.fileId);
      const { AppDataSource } = await import('../config/database');
      const { WorkflowFile } = await import('../entities/WorkflowFile');
      const { getTenantRepository } = await import('../utils/tenantRepository');
      const fileRepository = getTenantRepository(req, WorkflowFile);
      
      const file = await fileRepository.findOne({
        where: { id: fileId, clientId: req.clientId! },
      });

      if (!file) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'File not found', 404);
        return;
      }

      const storageEngine = await this.storageService.getStorageEngine(req.clientId!);
      if (!storageEngine) {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
        return;
      }

      // Ensure file path includes clientId if it doesn't already
      let filePath = file.filePath;
      if (!filePath.startsWith(`${req.clientId}/`)) {
        filePath = `${req.clientId}/${filePath}`;
      }

      const fileContent = await storageEngine.downloadFile(filePath);
      if (!fileContent) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'File not found in storage', 404);
        return;
      }

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalFileName}"`);
      res.setHeader('Content-Length', file.fileSize.toString());
      res.send(fileContent);
    } catch (error: any) {
      logger.error('Workflow file download error:', error);
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }
}

