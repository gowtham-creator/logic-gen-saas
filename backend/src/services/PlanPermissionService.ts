import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';

export class PlanPermissionService {
  /**
   * Check if a client's plan allows a specific permission
   */
  async checkPlanPermission(
    clientId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { id: clientId },
      relations: ['plan'],
    });

    if (!client || !client.plan) {
      // No plan assigned = no restrictions (for backward compatibility)
      // In production, you might want to return false
      return true;
    }

    // Check if plan is expired
    if (client.planExpiresAt && client.planExpiresAt < new Date()) {
      return false;
    }

    const plan = client.plan;
    const allowedActions = plan.allowedPermissions[resource];

    if (!allowedActions) {
      return false;
    }

    // Check if action is allowed (supports wildcard)
    return allowedActions.includes(action) || allowedActions.includes('*');
  }

  /**
   * Get all allowed permissions for a client's plan
   */
  async getClientPlanPermissions(clientId: string): Promise<Record<string, string[]>> {
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { id: clientId },
      relations: ['plan'],
    });

    if (!client || !client.plan) {
      return {}; // No plan = no permissions
    }

    // Check if plan is expired
    if (client.planExpiresAt && client.planExpiresAt < new Date()) {
      return {};
    }

    return client.plan.allowedPermissions;
  }

  /**
   * Check if a client's plan allows a specific limit
   */
  async checkPlanLimit(clientId: string, limitType: string, currentCount: number): Promise<boolean> {
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { id: clientId },
      relations: ['plan'],
    });

    if (!client || !client.plan) {
      return true; // No plan = no limits
    }

    // Check if plan is expired
    if (client.planExpiresAt && client.planExpiresAt < new Date()) {
      return false;
    }

    const limit = client.plan.limits[limitType];
    if (limit === undefined || limit === 0) {
      return true; // No limit set
    }

    return currentCount < limit;
  }

  /**
   * Get plan limits for a client
   */
  async getClientPlanLimits(clientId: string): Promise<Record<string, number>> {
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { id: clientId },
      relations: ['plan'],
    });

    if (!client || !client.plan) {
      return {};
    }

    // Check if plan is expired
    if (client.planExpiresAt && client.planExpiresAt < new Date()) {
      return {};
    }

    return client.plan.limits;
  }
}

