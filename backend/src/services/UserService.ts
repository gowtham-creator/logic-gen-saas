import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { PasswordHistory } from '../entities/PasswordHistory';
import bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from '../types/user.types';
import { triggerWebhook } from '../utils/webhookTrigger';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository, getTenantDataSource } from '../utils/tenantRepository';
import { getEmailUniquenessService } from './EmailUniquenessService';
import { IUserService } from '../interfaces/IUserService';
import { logger } from '../utils/logger';
import { TokenBlacklistService } from './TokenBlacklistService';
import { SECURITY_CONSTANTS } from '../constants/security';

/**
 * User service implementation
 * Handles user CRUD operations, password management, and email validation
 */
export class UserService implements IUserService {
  private blacklistService: TokenBlacklistService;

  /**
   * @param authService - Optional auth service for password hashing operations
   */
  constructor(private authService?: any) {
    // AuthService is optional - if not injected, methods that need it will handle it
    this.blacklistService = new TokenBlacklistService();
  }

  private getRepository(req?: TenantRequest): Repository<User> {
    return req ? getTenantRepository(req, User) : AppDataSource.getRepository(User);
  }

  private getDataSource(req?: TenantRequest) {
    return req ? getTenantDataSource(req) : AppDataSource;
  }

  private getPasswordHistoryRepository(req?: TenantRequest): Repository<PasswordHistory> {
    return req ? getTenantRepository(req, PasswordHistory) : AppDataSource.getRepository(PasswordHistory);
  }

  /**
   * Check if a password has been used recently (within password history)
   * @param userId - The ID of the user
   * @param newPassword - The plain text password to check
   * @param req - Optional tenant request context
   * @param historyCount - Number of previous passwords to check (default: 5)
   * @returns true if password was found in history, false otherwise
   */
  private async isPasswordInHistory(
    userId: string,
    newPassword: string,
    req?: TenantRequest,
    historyCount: number = 5
  ): Promise<boolean> {
    const passwordHistoryRepo = this.getPasswordHistoryRepository(req);
    
    // Get the last N password hashes for this user
    const passwordHistory = await passwordHistoryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: historyCount,
      select: ['passwordHash'],
    });

    // Check if the new password matches any previous password
    // Use bcrypt.compare because bcrypt hashes include salt and are different each time
    for (const history of passwordHistory) {
      const matches = await bcrypt.compare(newPassword, history.passwordHash);
      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Save password to history and maintain history limit
   * @param userId - The ID of the user
   * @param oldPasswordHash - The old password hash to save
   * @param req - Optional tenant request context
   * @param maxHistory - Maximum number of passwords to keep in history (default: 5)
   */
  private async savePasswordToHistory(
    userId: string,
    oldPasswordHash: string,
    req?: TenantRequest,
    maxHistory: number = 5
  ): Promise<void> {
    const passwordHistoryRepo = this.getPasswordHistoryRepository(req);
    
    // Save the old password to history
    const passwordHistory = passwordHistoryRepo.create({
      userId,
      passwordHash: oldPasswordHash,
    });
    await passwordHistoryRepo.save(passwordHistory);

    // Get all password history entries for this user, ordered by creation date
    const allHistory = await passwordHistoryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // If we have more than maxHistory entries, delete the oldest ones
    if (allHistory.length > maxHistory) {
      const toDelete = allHistory.slice(maxHistory);
      await passwordHistoryRepo.remove(toDelete);
    }
  }

  /**
   * Create a new user in the system
   * @param data - User creation data (email, password, firstName, lastName, etc.)
   * @param req - Optional tenant request context
   * @returns The created user entity
   * @throws Error if email already exists or validation fails
   */
  async createUser(data: CreateUserDto, req?: TenantRequest): Promise<User> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && data.clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(data.clientId);
      isolationLevel = config.isolationLevel;
    }

    // Normalize email to lowercase for comparison
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check if email is available using Redis (fast O(1) lookup)
    const emailUniquenessService = getEmailUniquenessService();
    const emailCheck = await emailUniquenessService.isEmailAvailable(normalizedEmail);
    
    if (!emailCheck.available) {
      throw new Error(emailCheck.message || `User with email ${data.email} already exists. Please use a different email address.`);
    }

    // Double-check in database if Redis check passed (fallback for Redis failures)
    // This ensures data consistency even if Redis is down
    const where: any = {};
    if (isolationLevel === 'database') {
      where.email = normalizedEmail;
    } else if (data.clientId) {
      where.email = normalizedEmail;
      where.clientId = data.clientId;
    } else {
      where.email = normalizedEmail;
    }
    
    const whereWithDeleted = { ...where, deletedAt: IsNull() };
    const existingUser = await repository.findOne({ where: whereWithDeleted });
    if (existingUser) {
      throw new Error(`User with email ${data.email} already exists. Please use a different email address.`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SECURITY_CONSTANTS.BCRYPT_ROUNDS);

    const user = repository.create({
      email: normalizedEmail, // Use normalized email (lowercase, trimmed)
      passwordHash,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      roleId: data.roleId || undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
      mustResetPassword: data.mustResetPassword !== undefined ? data.mustResetPassword : false,
      clientId: isolationLevel !== 'database' ? data.clientId : undefined,
      source: (data as any).source || 'direct', // Default to 'direct' if not specified
      externalId: (data as any).externalId || undefined,
    });

    const savedUser = await repository.save(user);

    // Add email to Redis for fast uniqueness checking
    await emailUniquenessService.addEmail(normalizedEmail);

    // Trigger webhook
    await triggerWebhook(
      data.clientId,
      'user.created',
      {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        roleId: savedUser.roleId,
        isActive: savedUser.isActive,
        createdAt: savedUser.createdAt,
      },
      undefined,
      req
    );

    return savedUser;
  }

  /**
   * Find or create a user from SSO authentication
   * @param userInfo - User information from SSO provider
   * @param clientId - The client/tenant ID
   * @param defaultRoleId - Default role ID to assign to new SSO users
   * @param req - Optional tenant request context
   * @returns The user entity (existing or newly created)
   * @throws Error if user creation fails or default role is missing
   */
  async findOrCreateSSOUser(
    userInfo: { email: string; firstName: string; lastName: string; externalId: string },
    clientId: string,
    defaultRoleId: string | null,
    req?: TenantRequest
  ): Promise<User> {
    const repository = this.getRepository(req);

    // Get isolation level
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    // Normalize email
    const normalizedEmail = userInfo.email.toLowerCase().trim();

    // Find existing user by email and clientId
    const where: any = { email: normalizedEmail, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const existingUser = await repository.findOne({ where });

    if (existingUser) {
      // Update externalId if it has changed
      if (existingUser.externalId !== userInfo.externalId) {
        existingUser.externalId = userInfo.externalId;
        await repository.save(existingUser);
        logger.info('Updated SSO user externalId', { userId: existingUser.id, email: normalizedEmail });
      }

      // Verify user is SSO user
      if (existingUser.source !== 'sso') {
        logger.warn('User exists but is not an SSO user', { userId: existingUser.id, email: normalizedEmail });
        // Optionally throw error or allow it
      }

      return existingUser;
    }

    // User doesn't exist - create new SSO user
    if (!defaultRoleId) {
      throw new Error('Default role ID is required for creating SSO users. Please configure defaultRoleId for the client.');
    }

    // Check if email is available (for consistency)
    const emailUniquenessService = getEmailUniquenessService();
    const emailCheck = await emailUniquenessService.isEmailAvailable(normalizedEmail);
    
    if (!emailCheck.available) {
      // Email exists but user not found in this tenant - this shouldn't happen, but handle gracefully
      throw new Error(`User with email ${userInfo.email} already exists in the system.`);
    }

    // Create new SSO user
    const newUser = repository.create({
      email: normalizedEmail,
      passwordHash: '', // SSO users don't have passwords
      firstName: userInfo.firstName.trim() || 'User',
      lastName: userInfo.lastName.trim() || '',
      roleId: defaultRoleId,
      clientId: isolationLevel !== 'database' ? clientId : undefined,
      source: 'sso',
      externalId: userInfo.externalId,
      isActive: true,
      mustResetPassword: false, // SSO users don't need password reset
    });

    const savedUser = await repository.save(newUser);

    // Add email to Redis
    await emailUniquenessService.addEmail(normalizedEmail);

    // Trigger webhook
    await triggerWebhook(
      clientId,
      'user.created',
      {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        roleId: savedUser.roleId,
        source: 'sso',
        isActive: savedUser.isActive,
        createdAt: savedUser.createdAt,
      },
      undefined,
      req
    );

    logger.info('Created new SSO user', { userId: savedUser.id, email: normalizedEmail, clientId });
    return savedUser;
  }

  /**
   * Update an existing user's information
   * @param id - The ID of the user to update
   * @param clientId - The client/tenant ID
   * @param data - Partial user data to update
   * @param req - Optional tenant request context
   * @returns The updated user entity
   * @throws Error if user is not found or validation fails
   */
  async updateUser(id: string, clientId: string, data: UpdateUserDto, req?: TenantRequest): Promise<User> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { id, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    const user = await repository.findOne({ where });

    if (!user) {
      throw new Error('User not found');
    }

    // Email cannot be updated - it's immutable for security reasons
    // (Email is intentionally excluded from UpdateUserDto)

    // Update password if provided
    // Prevent password updates for SSO users
    if (data.password) {
      // Block password changes for SSO users
      if (user.source === 'sso') {
        throw new Error('Password changes are not allowed for SSO users. Password is managed by the SSO provider.');
      }

      // Check password history before updating
      const isInHistory = await this.isPasswordInHistory(user.id, data.password, req, 5);
      if (isInHistory) {
        throw new Error(`Password cannot be reused. Please choose a password that the user hasn't used in their last 5 password changes.`);
      }

      // Save old password to history before updating
      const oldPasswordHash = user.passwordHash;
      await this.savePasswordToHistory(user.id, oldPasswordHash, req, 5);

      // Hash and set new password
      user.passwordHash = await bcrypt.hash(data.password, 10);
      // Automatically require password reset when password is changed
      user.mustResetPassword = true;

      // Blacklist all existing tokens for this user (security best practice)
      // This invalidates all sessions when password is changed
      await this.blacklistService.blacklistUserTokens(user.id);
    }

    // Update other fields
    if (data.firstName !== undefined) {
      user.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      user.lastName = data.lastName;
    }
    if (data.roleId !== undefined) {
      user.roleId = data.roleId || undefined;
    }
    if (data.isActive !== undefined) {
      // If user is being deactivated, blacklist all their tokens
      if (data.isActive === false && user.isActive === true) {
        await this.blacklistService.blacklistUserTokens(user.id);
      }
      user.isActive = data.isActive;
    }
    // Only update mustResetPassword if password is NOT being changed
    // (If password is changed, it's automatically set to true above)
    if (data.mustResetPassword !== undefined && !data.password) {
      user.mustResetPassword = data.mustResetPassword;
    }

    const savedUser = await repository.save(user);

    // Track what changed for webhook
    const changes: Record<string, unknown> = {};
    if (data.firstName !== undefined) changes.firstName = savedUser.firstName;
    if (data.lastName !== undefined) changes.lastName = savedUser.lastName;
    if (data.roleId !== undefined) changes.roleId = savedUser.roleId;
    if (data.isActive !== undefined) changes.isActive = savedUser.isActive;
    if (data.password) changes.passwordChanged = true;

    // Trigger webhook
    await triggerWebhook(
      clientId,
      'user.updated',
      {
        id: savedUser.id,
        email: savedUser.email,
        ...changes,
        updatedAt: savedUser.updatedAt,
      },
      undefined,
      req
    );

    // Trigger activation/deactivation events
    if (data.isActive !== undefined) {
      await triggerWebhook(
        clientId,
        savedUser.isActive ? 'user.activated' : 'user.deactivated',
        {
          id: savedUser.id,
          email: savedUser.email,
          isActive: savedUser.isActive,
        },
        undefined,
        req
      );
    }

    return savedUser;
  }

  /**
   * Reset a user's password
   * @param userId - The ID of the user
   * @param clientId - The client/tenant ID
   * @param newPassword - The new plain text password (will be hashed)
   * @param req - Optional tenant request context
   * @param checkHistory - Whether to check password history (default: true)
   * @param historyCount - Number of previous passwords to check (default: 5)
   * @returns The updated user entity
   * @throws Error if user is not found, is SSO user, validation fails, or password was recently used
   */
  async resetPassword(
    userId: string,
    clientId: string,
    newPassword: string,
    req?: TenantRequest,
    checkHistory: boolean = true,
    historyCount: number = 5
  ): Promise<User> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { id: userId };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    // Get user with password hash
    const user = await repository.findOne({
      where,
      select: ['id', 'passwordHash', 'source', 'clientId', 'email', 'firstName', 'lastName', 'roleId', 'isActive', 'mustResetPassword', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent password reset for SSO users
    if (user.source === 'sso') {
      throw new Error('Password reset is not available for SSO users. Password is managed by the SSO provider.');
    }

    // Prevent password reset for SSO users
    if (user.source === 'sso') {
      throw new Error('Password reset is not available for SSO users. Please use SSO login.');
    }

    // Check password history if enabled (before hashing, to compare against old hashes)
    if (checkHistory) {
      const isInHistory = await this.isPasswordInHistory(userId, newPassword, req, historyCount);
      if (isInHistory) {
        throw new Error(`Password cannot be reused. Please choose a password that you haven't used in your last ${historyCount} password changes.`);
      }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Save old password to history before updating
    const oldPasswordHash = user.passwordHash;
    await this.savePasswordToHistory(userId, oldPasswordHash, req, historyCount);

    // Update password and clear mustResetPassword flag
    user.passwordHash = newPasswordHash;
    user.mustResetPassword = false;

    const savedUser = await repository.save(user);

    // Blacklist all existing tokens for this user (security best practice)
    // This invalidates all sessions when password is changed
    await this.blacklistService.blacklistUserTokens(userId);

    return savedUser;
  }

  /**
   * Retrieve a user by ID
   * @param id - The ID of the user to retrieve
   * @param clientId - The client/tenant ID
   * @param includePasswordHash - Whether to include the password hash in the result (default: false)
   * @param req - Optional tenant request context
   * @returns The user entity with role relation, or null if not found
   */
  async getUserById(id: string, clientId: string, includePasswordHash = false, req?: TenantRequest): Promise<User | null> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { id };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    // For database-per-tenant, don't try to load client relation (it doesn't exist in tenant DB)
    const relations = isolationLevel === 'database' ? ['role'] : ['role', 'client'];
    
    return repository.findOne({
      where,
      relations,
    });
  }

  /**
   * List all users for a specific client/tenant
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @returns Array of user entities with role relation (excluding soft-deleted users)
   */
  async listUsers(clientId: string, req?: TenantRequest): Promise<User[]> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    // For database-per-tenant, all users in that database belong to that tenant
    // For shared, filter by clientId
    const where: any = { deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    return repository.find({
      where,
      relations: ['role'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Soft delete a user (sets deletedAt timestamp)
   * @param id - The ID of the user to delete
   * @param clientId - The client/tenant ID
   * @param req - Optional tenant request context
   * @throws Error if user is not found
   */
  async deleteUser(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { id, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    const user = await repository.findOne({ where });

    if (!user) {
      throw new Error('User not found');
    }

    // Trigger webhook before deletion
    await triggerWebhook(
      clientId,
      'user.deleted',
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      undefined,
      req
    );

    // Remove email from Redis before soft deleting user
    const emailUniquenessService = getEmailUniquenessService();
    await emailUniquenessService.removeEmail(user.email);

    // Soft delete user (set deletedAt)
    await repository.update(id, { deletedAt: new Date() });
  }

  /**
   * Check if email exists globally across all tenants using Redis
   * This ensures email uniqueness across the entire system with fast O(1) lookup
   */
  /**
   * Check if an email address is available for use
   * Uses Redis for fast lookup, with database fallback for consistency
   * @param email - The email address to check (will be normalized to lowercase)
   * @param excludeClientId - Optional client ID to exclude from the check (for cross-tenant checks)
   * @returns Object with availability status and optional message
   */
  async checkEmailAvailability(email: string, excludeClientId?: string): Promise<{ available: boolean; message?: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Use Redis for fast email availability check
    const emailUniquenessService = getEmailUniquenessService();
    const redisCheck = await emailUniquenessService.isEmailAvailable(normalizedEmail);
    
    if (!redisCheck.available) {
      return redisCheck;
    }

    // If Redis check passed but Redis might be down, do a fallback database check
    // This ensures we don't miss duplicates if Redis is unavailable
    if (!emailUniquenessService.isRedisConnected()) {
      // Redis is not connected, fall back to database check
      const mainUserRepository = AppDataSource.getRepository(User);
      const where: any = { email: normalizedEmail };
      const mainDbUser = await mainUserRepository.findOne({ where });
      
      if (mainDbUser) {
        if (excludeClientId && mainDbUser.clientId === excludeClientId) {
          // This is the same user being updated, so email is available
        } else {
          return {
            available: false,
            message: `Email ${email} already exists in the system`,
          };
        }
      }

      // Check in all database-per-tenant databases
      const { TenantDataSourceManager } = await import('./TenantDataSourceManager');
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      
      const clientRepository = AppDataSource.getRepository(Client);
      const dbConfigService = new DatabaseConfigService();
      const tenantDataSourceManager = new TenantDataSourceManager(AppDataSource);
      const allClients = await clientRepository.find();
      
      for (const client of allClients) {
        if (excludeClientId && client.id === excludeClientId) {
          continue;
        }

        const config = await dbConfigService.getClientDatabaseConfig(client.id);
        if (config.isolationLevel === 'database') {
          try {
            const tenantDataSource = await tenantDataSourceManager.getDataSource(client.id);
            const tenantUserRepository = tenantDataSource.getRepository(User);
            const tenantUser = await tenantUserRepository.findOne({
              where: { email: normalizedEmail },
            });
            
            if (tenantUser) {
              return {
                available: false,
                message: `Email ${email} already exists in tenant ${client.name}`,
              };
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to check email in tenant', { error: errorMessage, clientId: client.id });
          }
        }
      }
    }

    return { available: true };
  }
}

