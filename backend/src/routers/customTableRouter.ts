import { Router, Request, Response, NextFunction } from 'express';
import { CustomTableController } from '../controllers/CustomTableController';
import { authMiddleware } from '../middleware/auth';
import { authenticatedRateLimiter } from '../middleware/authenticatedRateLimiter';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new CustomTableController();

// All routes require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req as any, res, next).catch(next);
});

// Apply rate limiting after authentication (per-user rate limiting)
router.use(authenticatedRateLimiter());

// Validation schemas
const createCustomTableSchema = {
  body: Joi.object({
    tableName: Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).min(1).max(63).required(),
    columns: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).min(1).max(63).required(),
          type: Joi.string().required(),
          nullable: Joi.boolean().optional(),
          defaultValue: Joi.any().optional(),
          length: Joi.number().integer().positive().optional(),
          precision: Joi.number().integer().positive().optional(),
          scale: Joi.number().integer().min(0).optional(),
          unique: Joi.boolean().optional(),
        })
      )
      .min(1)
      .max(100)
      .required(),
    indexes: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).min(1).max(63).required(),
          columns: Joi.array().items(Joi.string()).min(1).required(),
          unique: Joi.boolean().optional(),
        })
      )
      .optional(),
    foreignKeys: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).min(1).max(63).required(),
          columns: Joi.array().items(Joi.string()).min(1).required(),
          referencedTable: Joi.string().required(),
          referencedColumns: Joi.array().items(Joi.string()).min(1).required(),
          onDelete: Joi.string().valid('CASCADE', 'RESTRICT', 'SET NULL', 'NO ACTION').optional(),
          onUpdate: Joi.string().valid('CASCADE', 'RESTRICT', 'SET NULL', 'NO ACTION').optional(),
        })
      )
      .optional(),
  }),
};

const addColumnSchema = {
  body: Joi.object({
    name: Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).min(1).max(63).required(),
    type: Joi.string().required(),
    nullable: Joi.boolean().optional(),
    defaultValue: Joi.any().optional(),
    length: Joi.number().integer().positive().optional(),
    precision: Joi.number().integer().positive().optional(),
    scale: Joi.number().integer().min(0).optional(),
    unique: Joi.boolean().optional(),
  }),
  params: Joi.object({
    tableName: Joi.string().required(),
  }),
};

// Routes
router.post('/', validate(createCustomTableSchema), (req, res, next) => {
  controller.create(req as any, res).catch(next);
});

router.get('/', (req, res, next) => {
  controller.list(req as any, res).catch(next);
});

router.get('/:tableName', (req, res, next) => {
  controller.get(req as any, res).catch(next);
});

router.post('/:tableName/columns', validate(addColumnSchema), (req, res, next) => {
  controller.addColumn(req as any, res).catch(next);
});

router.delete('/:tableName', (req, res, next) => {
  controller.delete(req as any, res).catch(next);
});

export default router;

