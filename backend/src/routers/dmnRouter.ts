import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate } from '../utils/validation';
import Joi from 'joi';
import * as DmnController from '../controllers/DmnController';
import { logger } from '../utils/logger';

const router = Router();

// Log that request reached DMN routes (before auth) so we can see flow when nothing else is printed
router.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('[DMN] request reached /api/dmn', { method: req.method, path: req.path });
  next();
});

router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Log after auth so we can see if hang/block is in rate limiter or validation
router.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('[DMN] after auth, before rate limit', { method: req.method, path: req.path });
  next();
});

// Skip authenticated rate limiter for POST /run (pipeline can take minutes; limiter/Redis was hanging)
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/run') return next();
  authenticatedRateLimiter()(req, res, next);
});

const runSchema = {
  body: Joi.object({
    fileId: Joi.string().uuid().required(),
    intent: Joi.string().valid('summarize', 'dmn_tables', 'dmn_code').required(),
    dmnName: Joi.string().allow('').optional(),
  }),
};

router.post(
  '/run',
  validate(runSchema),
  (req: Request, res: Response, next: NextFunction) => {
    DmnController.runPipeline(req as any, res).catch(next);
  }
);

router.get('/jobs', (req: Request, res: Response, next: NextFunction) => {
  DmnController.listJobs(req as any, res).catch(next);
});

router.get(
  '/jobs/:jobId',
  validate({ params: Joi.object({ jobId: Joi.string().required() }) }),
  (req: Request, res: Response, next: NextFunction) => {
    DmnController.getJobStatus(req as any, res).catch(next);
  }
);

router.delete(
  '/jobs/:jobId',
  validate({ params: Joi.object({ jobId: Joi.string().required() }) }),
  (req: Request, res: Response, next: NextFunction) => {
    DmnController.deleteJob(req as any, res).catch(next);
  }
);

router.post(
  '/jobs/:jobId/resume',
  validate({ params: Joi.object({ jobId: Joi.string().required() }) }),
  (req: Request, res: Response, next: NextFunction) => {
    DmnController.resumeJob(req as any, res).catch(next);
  }
);

router.get(
  '/jobs/:jobId/progress',
  validate({ params: Joi.object({ jobId: Joi.string().required() }) }),
  (req: Request, res: Response, next: NextFunction) => {
    DmnController.getJobProgress(req as any, res).catch(next);
  }
);

router.get(
  '/jobs/:jobId/result',
  validate({ params: Joi.object({ jobId: Joi.string().required() }) }),
  (req: Request, res: Response, next: NextFunction) => {
    DmnController.getJobResult(req as any, res).catch(next);
  }
);

router.get('/stages', (req: Request, res: Response, next: NextFunction) => {
  DmnController.getStages(req as any, res).catch(next);
});

router.get('/health', (req: Request, res: Response, next: NextFunction) => {
  DmnController.getHealth(req as any, res).catch(next);
});

export default router;
