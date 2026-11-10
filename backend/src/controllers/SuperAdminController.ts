import { Response } from 'express';
import { SuperAdminService, CreateSuperAdminDto, UpdateSuperAdminDto } from '../services/SuperAdminService';
import { SuperAdminAuthenticatedRequest } from '../types/middleware.types';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { UserService } from '../services/UserService';
import bcrypt from 'bcryptjs';
import { asParam } from '../utils/params';

export class SuperAdminController {
  private superAdminService: SuperAdminService;
  private userService: UserService;

  constructor() {
    this.superAdminService = new SuperAdminService();
    this.userService = new UserService();
  }

  async create(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateSuperAdminDto = req.body;
      const admin = await this.superAdminService.createSuperAdmin(data);
      
      // Don't return password hash
      const { passwordHash: _passwordHash, refreshToken: _refreshToken, refreshTokenExpiresAt: _refreshTokenExpiresAt, ...adminResponse } = admin;
      
      sendSuccess(res, adminResponse);
    } catch (error: any) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
  }

  async update(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const data: UpdateSuperAdminDto = req.body;
      const admin = await this.superAdminService.updateSuperAdmin(id, data);
      
      // Don't return password hash
      const { passwordHash: _passwordHash, refreshToken: _refreshToken, refreshTokenExpiresAt: _refreshTokenExpiresAt, ...adminResponse } = admin;
      
      sendSuccess(res, adminResponse);
    } catch (error: any) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
  }

  async delete(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      
      // Prevent deleting yourself
      if (id === req.adminId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Cannot delete your own account', 400);
        return;
      }
      
      await this.superAdminService.deleteSuperAdmin(id);
      sendSuccess(res, { message: 'Super admin deleted successfully' });
    } catch (error: any) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
  }

  async get(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const admin = await this.superAdminService.getSuperAdmin(id);
      
      if (!admin) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Super admin not found', 404);
        return;
      }
      
      // Don't return password hash
      const { passwordHash: _passwordHash, refreshToken: _refreshToken, refreshTokenExpiresAt: _refreshTokenExpiresAt, ...adminResponse } = admin;
      
      sendSuccess(res, adminResponse);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async list(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const admins = await this.superAdminService.listSuperAdmins();
      
      // Remove password hashes from all admins
      const adminsResponse = admins.map(({ passwordHash: _passwordHash, refreshToken: _refreshToken, refreshTokenExpiresAt: _refreshTokenExpiresAt, ...admin }) => admin);
      
      sendSuccess(res, adminsResponse);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async activate(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const admin = await this.superAdminService.activateSuperAdmin(id);
      
      const { passwordHash: _passwordHash, refreshToken: _refreshToken, refreshTokenExpiresAt: _refreshTokenExpiresAt, ...adminResponse } = admin;
      
      sendSuccess(res, adminResponse);
    } catch (error: any) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
  }

  async deactivate(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      
      // Prevent deactivating yourself
      if (id === req.adminId) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Cannot deactivate your own account', 400);
        return;
      }
      
      const admin = await this.superAdminService.deactivateSuperAdmin(id);
      
      const { passwordHash: _passwordHash, refreshToken: _refreshToken, refreshTokenExpiresAt: _refreshTokenExpiresAt, ...adminResponse } = admin;
      
      sendSuccess(res, adminResponse);
    } catch (error: any) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
  }

  // System Users Management (users with isSuperAdmin or isDeveloper flags)
  async listSystemUsers(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      
      // Get all users with isSuperAdmin or isDeveloper flags
      const systemUsers = await userRepository.find({
        where: [
          { isSuperAdmin: true },
          { isDeveloper: true },
        ],
        relations: ['client', 'role'],
        order: { createdAt: 'DESC' },
      });

      const safeUsers = systemUsers.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        isDeveloper: user.isDeveloper,
        isActive: user.isActive,
        client: user.client ? {
          id: user.client.id,
          name: user.client.name,
          subdomain: user.client.subdomain,
        } : null,
        role: user.role ? {
          id: user.role.id,
          name: user.role.name,
        } : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      sendSuccess(res, safeUsers);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async createSystemUser(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, isSuperAdmin, isDeveloper, clientId } = req.body;

      if (!email || !password || !firstName || !lastName) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Email, password, first name, and last name are required', 400);
        return;
      }

      if (!isSuperAdmin && !isDeveloper) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'User must be either super admin or developer', 400);
        return;
      }

      const userRepository = AppDataSource.getRepository(User);
      
      // Check if user already exists
      const existingUser = await userRepository.findOne({ where: { email } });
      if (existingUser) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'User with this email already exists', 400);
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = userRepository.create({
        email,
        passwordHash,
        firstName,
        lastName,
        isSuperAdmin: isSuperAdmin || false,
        isDeveloper: isDeveloper || false,
        clientId: clientId || null,
        isActive: true,
      });

      const savedUser = await userRepository.save(user);

      const { passwordHash: _, ...safeUser } = savedUser;
      sendSuccess(res, safeUser, 201);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async updateSystemUser(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const { password, firstName, lastName, isSuperAdmin, isDeveloper, isActive } = req.body;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id } });

      if (!user) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'User not found', 404);
        return;
      }

      // Prevent updating yourself - get current user from JWT token
      const jwt = await import('jsonwebtoken');
      const { config } = await import('../config/config');
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.default.verify(token, config.jwt.secret) as any;
          if (decoded.userId === id && isActive === false) {
            sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Cannot deactivate your own account', 400);
            return;
          }
        } catch {
          // Token invalid, continue
        }
      }

      // Update fields
      if (password) {
        // Use UserService.resetPassword to handle password history properly
        // This ensures password history is checked and maintained
        try {
          // Get clientId if available (system users might not have clientId)
          const clientId = user.clientId || '';
          await this.userService.resetPassword(user.id, clientId, password, undefined, true, 5);
          // Password is already updated by resetPassword, so we don't need to update it again
          // But we need to reload the user to get the updated passwordHash
          const updatedUser = await userRepository.findOne({ where: { id: user.id } });
          if (updatedUser) {
            user.passwordHash = updatedUser.passwordHash;
          }
        } catch (error: any) {
          // If password history check fails, return the error
          sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
          return;
        }
      }
      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (isSuperAdmin !== undefined) user.isSuperAdmin = isSuperAdmin;
      if (isDeveloper !== undefined) user.isDeveloper = isDeveloper;
      if (isActive !== undefined) user.isActive = isActive;

      const updatedUser = await userRepository.save(user);

      const { passwordHash: _, ...safeUser } = updatedUser;
      sendSuccess(res, safeUser);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async deleteSystemUser(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);

      // Prevent deleting yourself - get current user from JWT token
      const userRepository = AppDataSource.getRepository(User);
      const jwt = await import('jsonwebtoken');
      const { config } = await import('../config/config');
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.default.verify(token, config.jwt.secret) as any;
          if (decoded.userId === id) {
            sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Cannot delete your own account', 400);
            return;
          }
        } catch {
          // Token invalid, continue
        }
      }

      await userRepository.delete(id);
      sendSuccess(res, { message: 'System user deleted successfully' });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async searchUser(req: SuperAdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Email query parameter is required', 400);
        return;
      }

      const userRepository = AppDataSource.getRepository(User);

      // Search for user by email across all tenants (shared database)
      const user = await userRepository.findOne({
        where: { email: email.toLowerCase().trim() },
        relations: ['client', 'role'],
      });

      if (!user) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'User not found', 404);
        return;
      }

      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin || false,
        isDeveloper: user.isDeveloper || false,
        client: user.client ? {
          id: user.client.id,
          name: user.client.name,
          subdomain: user.client.subdomain,
        } : null,
      };

      sendSuccess(res, safeUser);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }
}

