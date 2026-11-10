import { Router } from 'express';
import { SuperAdminController } from '../controllers/SuperAdminController';
import { superAdminAuthMiddleware } from '../middleware/superAdminAuth';
import { authMiddleware } from '../middleware/auth';
import { superAdminMiddleware } from '../middleware/superAdmin';
import { validate, schemas } from '../utils/validation';
import Joi from 'joi';

const router = Router();
const controller = new SuperAdminController();

// Validation schemas
const createSuperAdminSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    roleId: schemas.uuid.optional(),
    isActive: Joi.boolean().optional(),
  }),
};

const updateSuperAdminSchema = {
  body: Joi.object({
    email: Joi.string().email().optional(),
    password: Joi.string().min(8).optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    roleId: schemas.uuid.optional(),
    isActive: Joi.boolean().optional(),
    mustResetPassword: Joi.boolean().optional(),
  }),
};

// Routes

// System Users Management Routes (must come before /:id routes to avoid route conflicts)
// These routes use regular auth + superAdmin middleware (for users with isSuperAdmin flag)
// instead of superAdminAuthMiddleware (for SuperAdmin entities)
router.get('/system-users', 
  async (req, res, next) => {
    await authMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    await superAdminMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.listSystemUsers(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/system-users', 
  async (req, res, next) => {
    await authMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    await superAdminMiddleware(req as any, res, next);
  },
  validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      isSuperAdmin: Joi.boolean().optional(),
      isDeveloper: Joi.boolean().optional(),
      clientId: schemas.uuid.optional(),
    }),
  }), 
  async (req, res, next) => {
    try {
      await controller.createSystemUser(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.put('/system-users/:id', 
  async (req, res, next) => {
    await authMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    await superAdminMiddleware(req as any, res, next);
  },
  validate({
    body: Joi.object({
      password: Joi.string().min(8).optional(),
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      isSuperAdmin: Joi.boolean().optional(),
      isDeveloper: Joi.boolean().optional(),
      isActive: Joi.boolean().optional(),
    }),
  }), 
  async (req, res, next) => {
    try {
      await controller.updateSystemUser(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/system-users/:id', 
  async (req, res, next) => {
    await authMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    await superAdminMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.deleteSystemUser(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

// Search user by email across all tenants
router.get('/users/search', 
  async (req, res, next) => {
    await authMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    await superAdminMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.searchUser(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

// Super Admin routes (use superAdminAuthMiddleware for SuperAdmin entities)
router.post('/', 
  async (req, res, next) => {
    await superAdminAuthMiddleware(req as any, res, next);
  },
  validate(createSuperAdminSchema), 
  async (req, res, next) => {
    try {
      await controller.create(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', 
  async (req, res, next) => {
    await superAdminAuthMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.list(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', 
  async (req, res, next) => {
    await superAdminAuthMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.get(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.put('/:id', 
  async (req, res, next) => {
    await superAdminAuthMiddleware(req as any, res, next);
  },
  validate(updateSuperAdminSchema), 
  async (req, res, next) => {
    try {
      await controller.update(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', 
  async (req, res, next) => {
    await superAdminAuthMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.delete(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/activate', 
  async (req, res, next) => {
    await superAdminAuthMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.activate(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/deactivate', 
  async (req, res, next) => {
    await superAdminAuthMiddleware(req as any, res, next);
  },
  async (req, res, next) => {
    try {
      await controller.deactivate(req as any, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

