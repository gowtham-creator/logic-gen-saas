import { TenantRequest } from '../types/middleware.types';

/**
 * Helper to get isolation level for a client
 */
export async function getIsolationLevel(
  req: TenantRequest | undefined,
  clientId: string | undefined
): Promise<string> {
  if (req?.tenantDataSource && clientId) {
    const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
    const dbConfigService = new DatabaseConfigService();
    const config = await dbConfigService.getClientDatabaseConfig(clientId);
    return config.isolationLevel;
  }
  return 'shared';
}

/**
 * Helper to build where clause based on isolation level
 */
export function buildWhereClause(
  isolationLevel: string,
  baseWhere: Record<string, any>,
  clientId?: string
): Record<string, any> {
  const where = { ...baseWhere };
  if (isolationLevel !== 'database' && clientId) {
    where.clientId = clientId;
  }
  return where;
}

