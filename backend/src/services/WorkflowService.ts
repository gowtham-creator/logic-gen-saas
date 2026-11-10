import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Workflow } from '../entities/Workflow';
import { WorkflowFile } from '../entities/WorkflowFile';
import { getTenantRepository, getTenantDataSource } from '../utils/tenantRepository';
import { TenantRequest } from '../types/middleware.types';
import { StorageService } from './StorageService';
import { logger } from '../utils/logger';
import { triggerWebhook } from '../utils/webhookTrigger';

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  clientId: string;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface WorkflowFileDto {
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
}

export class WorkflowService {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
  }

  private getWorkflowRepository(req?: TenantRequest): Repository<Workflow> {
    return req ? getTenantRepository(req, Workflow) : AppDataSource.getRepository(Workflow);
  }

  private getWorkflowFileRepository(req?: TenantRequest): Repository<WorkflowFile> {
    return req ? getTenantRepository(req, WorkflowFile) : AppDataSource.getRepository(WorkflowFile);
  }

  async createWorkflow(data: CreateWorkflowDto, userId: string, req?: TenantRequest): Promise<Workflow> {
    const repository = this.getWorkflowRepository(req);
    
    const workflow = repository.create({
      name: data.name,
      description: data.description,
      clientId: data.clientId,
      createdUserId: userId,
      updatedUserId: userId,
      isActive: true,
    });

    const saved = await repository.save(workflow);

    // Trigger webhook
    await triggerWebhook(
      data.clientId,
      'workflow.created',
      { workflow: saved },
      {},
      req
    );

    return saved;
  }

  async updateWorkflow(
    id: string,
    data: UpdateWorkflowDto,
    userId: string,
    clientId: string,
    req?: TenantRequest
  ): Promise<Workflow> {
    const repository = this.getWorkflowRepository(req);
    
    const workflow = await repository.findOne({
      where: { id, clientId, deletedAt: IsNull() },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    Object.assign(workflow, {
      ...data,
      updatedUserId: userId,
    });

    const updated = await repository.save(workflow);

    // Trigger webhook
    await triggerWebhook(
      clientId,
      'workflow.updated',
      { workflow: updated },
      {},
      req
    );

    return updated;
  }

  async deleteWorkflow(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getWorkflowRepository(req);
    const fileRepository = this.getWorkflowFileRepository(req);
    
    const workflow = await repository.findOne({
      where: { id, clientId, deletedAt: IsNull() },
      relations: ['files'],
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Delete all files from storage (hard delete files from storage)
    if (workflow.files && workflow.files.length > 0) {
      const storageEngine = await this.storageService.getStorageEngine(clientId);
      if (storageEngine) {
        for (const file of workflow.files) {
          try {
            // Ensure file path includes clientId if it doesn't already
            let filePath = file.filePath;
            if (!filePath.startsWith(`${clientId}/`)) {
              filePath = `${clientId}/${filePath}`;
            }
            await storageEngine.deleteFile(filePath);
          } catch (error: any) {
            logger.error(`Failed to delete file ${file.filePath}:`, error);
          }
        }
      }
      // Hard delete file records (files in storage should be hard deleted)
      await fileRepository.remove(workflow.files);
    }

    // Soft delete workflow (set deletedAt)
    await repository.update(id, { deletedAt: new Date() });

    // Trigger webhook
    await triggerWebhook(
      clientId,
      'workflow.deleted',
      { workflowId: id },
      {},
      req
    );
  }

  async getWorkflowById(id: string, clientId: string, req?: TenantRequest): Promise<Workflow | null> {
    const repository = this.getWorkflowRepository(req);
    
    return repository.findOne({
      where: { id, clientId, deletedAt: IsNull() },
      relations: ['createdUser', 'updatedUser', 'files', 'files.createdUser'],
      order: { files: { createdAt: 'DESC' } },
    });
  }

  async listWorkflows(clientId: string, req?: TenantRequest): Promise<Workflow[]> {
    const repository = this.getWorkflowRepository(req);
    
    return repository.find({
      where: { clientId, deletedAt: IsNull() },
      relations: ['createdUser', 'updatedUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async addFileToWorkflow(
    workflowId: string,
    fileData: WorkflowFileDto,
    userId: string,
    clientId: string,
    req?: TenantRequest
  ): Promise<WorkflowFile> {
    const workflowRepository = this.getWorkflowRepository(req);
    const fileRepository = this.getWorkflowFileRepository(req);
    
    const workflow = await workflowRepository.findOne({
      where: { id: workflowId, clientId, deletedAt: IsNull() },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const file = fileRepository.create({
      workflowId,
      fileName: fileData.fileName,
      originalFileName: fileData.originalFileName,
      filePath: fileData.filePath,
      mimeType: fileData.mimeType,
      fileSize: fileData.fileSize,
      clientId,
      createdUserId: userId,
      updatedUserId: userId,
      isActive: true,
    });

    const saved = await fileRepository.save(file);

    // Trigger webhook
    await triggerWebhook(
      clientId,
      'workflow.file_added',
      { workflowId, file: saved },
      {},
      req
    );

    return saved;
  }

  async deleteWorkflowFile(
    fileId: string,
    clientId: string,
    req?: TenantRequest
  ): Promise<void> {
    const fileRepository = this.getWorkflowFileRepository(req);
    
    const file = await fileRepository.findOne({
      where: { id: fileId, clientId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Delete from storage
    const storageEngine = await this.storageService.getStorageEngine(clientId);
    if (storageEngine) {
      try {
        // Ensure file path includes clientId if it doesn't already
        let filePath = file.filePath;
        if (!filePath.startsWith(`${clientId}/`)) {
          filePath = `${clientId}/${filePath}`;
        }
        await storageEngine.deleteFile(filePath);
      } catch (error: any) {
        logger.error(`Failed to delete file ${file.filePath}:`, error);
      }
    }

    await fileRepository.remove(file);

    // Trigger webhook
    await triggerWebhook(
      clientId,
      'workflow.file_deleted',
      { workflowId: file.workflowId, fileId },
      {},
      req
    );
  }

  async getWorkflowFileById(fileId: string, clientId: string, req?: TenantRequest): Promise<WorkflowFile | null> {
    const fileRepository = this.getWorkflowFileRepository(req);
    return fileRepository.findOne({
      where: { id: fileId, clientId },
    });
  }

  async getWorkflowFiles(workflowIds: string[], clientId: string, req?: TenantRequest): Promise<WorkflowFile[]> {
    const fileRepository = this.getWorkflowFileRepository(req);
    const workflowRepository = this.getWorkflowRepository(req);
    
    // Only get files for workflows that are not soft-deleted
    const activeWorkflows = await workflowRepository.find({
      where: workflowIds.map(id => ({ id, clientId, deletedAt: IsNull() })),
      select: ['id'],
    });
    const activeWorkflowIds = activeWorkflows.map(w => w.id);
    
    return fileRepository.find({
      where: activeWorkflowIds.map(id => ({ workflowId: id, clientId })),
      relations: ['workflow', 'createdUser'],
      order: { createdAt: 'DESC' },
    });
  }
}

