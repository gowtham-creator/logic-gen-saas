import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Plan } from '../entities/Plan';
import { Client } from '../entities/Client';
import { CreatePlanDto, UpdatePlanDto } from '../types/plan.types';

export class PlanService {
  private planRepository: Repository<Plan>;

  constructor() {
    this.planRepository = AppDataSource.getRepository(Plan);
  }

  async createPlan(data: CreatePlanDto): Promise<Plan> {
    const existing = await this.planRepository.findOne({
      where: { name: data.name, deletedAt: IsNull() },
    });

    if (existing) {
      throw new Error('Plan with this name already exists');
    }

    const plan = this.planRepository.create({
      name: data.name,
      description: data.description,
      price: data.price,
      billingPeriod: data.billingPeriod,
      allowedPermissions: data.allowedPermissions,
      limits: data.limits,
      databasePermissions: data.databasePermissions || {
        allowedIsolationLevels: ['shared'],
        allowCustomTables: false,
        allowCustomColumns: false,
        allowCustomMigrations: false,
      },
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    return this.planRepository.save(plan);
  }

  async updatePlan(id: string, data: UpdatePlanDto): Promise<Plan> {
    const plan = await this.planRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    if (data.name && data.name !== plan.name) {
      const existing = await this.planRepository.findOne({
        where: { name: data.name, deletedAt: IsNull() },
      });
      if (existing) {
        throw new Error('Plan name already taken');
      }
    }

    Object.assign(plan, data);
    return this.planRepository.save(plan);
  }

  async getPlan(id: string): Promise<Plan | null> {
    return this.planRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async listPlans(): Promise<Plan[]> {
    return this.planRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async deletePlan(id: string): Promise<void> {
    // Check if plan is assigned to any clients (excluding soft-deleted clients)
    const clientRepository = AppDataSource.getRepository(Client);
    const clientCount = await clientRepository.count({
      where: { planId: id, deletedAt: IsNull() },
    });

    if (clientCount > 0) {
      throw new Error('Cannot delete plan that is assigned to clients');
    }

    // Soft delete (set deletedAt)
    await this.planRepository.update({ id }, { deletedAt: new Date() });
  }

  /**
   * Get allowed permissions for a plan
   */
  async getPlanPermissions(planId: string): Promise<Record<string, string[]>> {
    const plan = await this.planRepository.findOne({
      where: { id: planId, deletedAt: IsNull() },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    return plan.allowedPermissions;
  }
}

