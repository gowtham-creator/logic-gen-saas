import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '../constants/errors';
import { ValidationSchema } from '../types/common.types';

export { ValidationSchema };

/**
 * Middleware factory for Joi validation
 */
export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details.map((d) => d.message).join(', ')}`);
      }
    }

    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details.map((d) => d.message).join(', ')}`);
      }
    }

    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(`Params: ${error.details.map((d) => d.message).join(', ')}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: errors.join('; ') },
      });
      return;
    }

    next();
  };
}

/**
 * Strong password validation
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Common validation schemas
export const schemas = {
  uuid: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(passwordPattern)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    }),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  },
};

