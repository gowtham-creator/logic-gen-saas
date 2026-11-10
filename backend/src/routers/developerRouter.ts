import { Router } from 'express';
import { DeveloperController } from '../controllers/DeveloperController';
import { combinedAuthMiddleware } from '../middleware/combinedAuth';
import { developerMiddleware } from '../middleware/developer';

const router = Router();
const controller = new DeveloperController();

// All developer routes require authentication and developer access
router.use(combinedAuthMiddleware as any);
router.use(developerMiddleware as any);

router.get('/tenants', (req, res) => controller.getAllTenants(req as any, res));
router.get('/tenants/:tenantId', (req, res) => controller.getTenantDetails(req as any, res));
router.get('/tenants/:tenantId/audit-logs', (req, res) => controller.getTenantAuditLogs(req as any, res));
router.get('/stats', (req, res) => controller.getSystemStats(req as any, res));

export default router;

