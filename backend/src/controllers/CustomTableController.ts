import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { CustomTableService } from '../services/CustomTableService';
import { CreateCustomTableDto, AddColumnDto } from '../types/customTable.types';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { asParam } from '../utils/params';

export class CustomTableController {
  private customTableService: CustomTableService;
  private auditService: AuditService;

  constructor() {
    this.customTableService = new CustomTableService();
    this.auditService = new AuditService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateCustomTableDto = req.body;
      const customTable = await this.customTableService.createCustomTable(req, data);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'custom_table.created',
        resourceType: 'custom_table',
        resourceId: customTable.id,
        metadata: { tableName: customTable.tableName },
      }, req);

      sendSuccess(res, customTable, 201);
    } catch (error: any) {
      sendError(res, 'CUSTOM_TABLE_ERROR', error.message || 'Failed to create custom table', 400);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const customTables = await this.customTableService.listCustomTables(req.clientId!);
      sendSuccess(res, customTables);
    } catch (error: any) {
      sendError(res, 'CUSTOM_TABLE_ERROR', error.message || 'Failed to list custom tables', 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tableName = asParam(req.params.tableName);
      const customTable = await this.customTableService.getCustomTable(
        req.clientId!,
        tableName
      );

      if (!customTable) {
        sendError(res, 'NOT_FOUND', 'Custom table not found', 404);
        return;
      }

      sendSuccess(res, customTable);
    } catch (error: any) {
      sendError(res, 'CUSTOM_TABLE_ERROR', error.message || 'Failed to get custom table', 500);
    }
  }

  async addColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tableName = asParam(req.params.tableName);
      const column: AddColumnDto = req.body;

      await this.customTableService.addColumn(req, tableName, column);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'custom_table.column_added',
        resourceType: 'custom_table',
        resourceId: tableName,
        metadata: { columnName: column.name },
      }, req);

      sendSuccess(res, { message: 'Column added successfully' });
    } catch (error: any) {
      sendError(res, 'CUSTOM_TABLE_ERROR', error.message || 'Failed to add column', 400);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tableName = asParam(req.params.tableName);
      await this.customTableService.deleteCustomTable(req, tableName);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'custom_table.deleted',
        resourceType: 'custom_table',
        resourceId: tableName,
        metadata: { tableName },
      }, req);

      sendSuccess(res, { message: 'Custom table deleted successfully' });
    } catch (error: any) {
      sendError(res, 'CUSTOM_TABLE_ERROR', error.message || 'Failed to delete custom table', 400);
    }
  }
}

