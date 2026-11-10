import { Response, NextFunction } from 'express';
import { TenantRequest } from '../types/middleware.types';
import { getTenantDataSourceManager } from '../services/TenantDataSourceManager';
import { logger } from '../utils/logger';

/**
 * Middleware to attach tenant-specific DataSource to request
 * This enables plan-based database isolation (shared/schema/database)
 */
export async function tenantDataSourceMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.clientId) {
      return next(new Error('Client ID not found. Ensure subdomainMiddleware runs before this.'));
    }

    logger.debug('Getting DataSource for client', { clientId: req.clientId });
    
    const tenantDataSourceManager = getTenantDataSourceManager();
    const tenantDataSource = await tenantDataSourceManager.getDataSource(req.clientId);

    // Attach DataSource to request
    req.tenantDataSource = tenantDataSource;
    logger.debug('Tenant DataSource attached', {
      clientId: req.clientId,
      dataSourceType: tenantDataSource === tenantDataSourceManager['sharedDataSource'] ? 'shared' : 'tenant-specific',
    });

    next();
  } catch (error) {
    logger.error('Error in tenantDataSourceMiddleware', { error, clientId: req.clientId });
    next(error);
  }
}

