import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { ClientService } from '../services/ClientService';
import { CreateClientDto, UpdateClientDto } from '../types/client.types';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { getSSOConfigEncryptionService } from '../services/SSOConfigEncryptionService';
import { asParam } from '../utils/params';

export class ClientController {
  private clientService: ClientService;
  private auditService: AuditService;

  constructor() {
    this.clientService = new ClientService();
    this.auditService = new AuditService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateClientDto = req.body;
      const client = await this.clientService.createClient(data);

      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'client.created',
        resourceType: 'Client',
        resourceId: client.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Sanitize SSO and storage config before sending response
      const sanitizedClient = await this.clientService.sanitizeClientForResponse(client);
      sendSuccess(res, sanitizedClient, 201);
    } catch (error: any) {
      sendError(res, 'CREATE_CLIENT_ERROR', error.message, 400);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check if user is super admin
      if (!req.user?.isSuperAdmin) {
        sendError(res, 'FORBIDDEN', 'Only super admins can list all clients', 403);
        return;
      }

      const clients = await this.clientService.listClients();
      // Sanitize SSO and storage config before sending response
      const sanitizedClients = await this.clientService.sanitizeClientsForResponse(clients);
      sendSuccess(res, sanitizedClients);
    } catch (error: any) {
      sendError(res, 'LIST_CLIENTS_ERROR', error.message, 500);
    }
  }

  async checkMigration(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const { newIsolationLevel } = req.body;

      if (!newIsolationLevel) {
        sendError(res, 'VALIDATION_ERROR', 'newIsolationLevel is required', 400);
        return;
      }

      const result = await this.clientService.checkMigrationNeeded(id, newIsolationLevel);
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, 'CHECK_MIGRATION_ERROR', error.message, 500);
    }
  }

  async migrateDatabase(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const { newIsolationLevel, removeFromSource } = req.body;

      if (!newIsolationLevel) {
        sendError(res, 'VALIDATION_ERROR', 'newIsolationLevel is required', 400);
        return;
      }

      const result = await this.clientService.migrateDatabase(id, newIsolationLevel, removeFromSource === true);

      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'client.database.migrated',
        resourceType: 'Client',
        resourceId: id,
        metadata: { migrationResult: result },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      if (result.success) {
        sendSuccess(res, result, 200);
      } else {
        sendError(res, 'MIGRATION_ERROR', result.error || 'Migration failed', 500);
      }
    } catch (error: any) {
      sendError(res, 'MIGRATION_ERROR', error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const client = await this.clientService.getClient(id);

      if (!client) {
        sendError(res, 'CLIENT_NOT_FOUND', 'Client not found', 404);
        return;
      }

      // Sanitize SSO config before sending response
      const sanitizedClient = this.clientService.sanitizeClientForResponse(client);
      sendSuccess(res, sanitizedClient);
    } catch (error: any) {
      sendError(res, 'GET_CLIENT_ERROR', error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const data: UpdateClientDto = req.body;

      const client = await this.clientService.updateClient(id, data);

      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'client.updated',
        resourceType: 'Client',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Sanitize SSO config before sending response
      const sanitizedClient = this.clientService.sanitizeClientForResponse(client);
      sendSuccess(res, sanitizedClient);
    } catch (error: any) {
      sendError(res, 'UPDATE_CLIENT_ERROR', error.message, 400);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);

      // Super admin only - can delete any client
      await this.clientService.deleteClient(id);

      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'client.deleted',
        resourceType: 'Client',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, { message: 'Client deleted successfully' });
    } catch (error: any) {
      sendError(res, 'DELETE_CLIENT_ERROR', error.message, 400);
    }
  }
}

