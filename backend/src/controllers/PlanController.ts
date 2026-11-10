import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { PlanService } from '../services/PlanService';
import { CreatePlanDto, UpdatePlanDto } from '../types/plan.types';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { asParam } from '../utils/params';

export class PlanController {
  private planService: PlanService;
  private auditService: AuditService;

  constructor() {
    this.planService = new PlanService();
    this.auditService = new AuditService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreatePlanDto = req.body;
      const plan = await this.planService.createPlan(data);

      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'plan.created',
        resourceType: 'Plan',
        resourceId: plan.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, plan, 201);
    } catch (error: any) {
      sendError(res, 'CREATE_PLAN_ERROR', error.message, 400);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const plans = await this.planService.listPlans();
      sendSuccess(res, plans);
    } catch (error: any) {
      sendError(res, 'LIST_PLANS_ERROR', error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const plan = await this.planService.getPlan(id);

      if (!plan) {
        sendError(res, 'PLAN_NOT_FOUND', 'Plan not found', 404);
        return;
      }

      sendSuccess(res, plan);
    } catch (error: any) {
      sendError(res, 'GET_PLAN_ERROR', error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const data: UpdatePlanDto = req.body;

      const plan = await this.planService.updatePlan(id, data);

      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'plan.updated',
        resourceType: 'Plan',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, plan);
    } catch (error: any) {
      sendError(res, 'UPDATE_PLAN_ERROR', error.message, 400);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      await this.planService.deletePlan(id);

      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'plan.deleted',
        resourceType: 'Plan',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, { message: 'Plan deleted successfully' });
    } catch (error: any) {
      sendError(res, 'DELETE_PLAN_ERROR', error.message, 400);
    }
  }
}

