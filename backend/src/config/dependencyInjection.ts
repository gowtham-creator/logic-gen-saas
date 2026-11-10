/**
 * Dependency Injection Container
 * 
 * This file sets up and provides all service instances with proper dependency injection.
 * Controllers receive their dependencies through constructor injection, following SOLID principles.
 */

import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { MFAService } from '../services/MFAService';
import { AuditService } from '../services/AuditService';
import { PermissionService } from '../services/PermissionService';
import { AuthController } from '../controllers/AuthController';
import { UserController } from '../controllers/UserController';
import { MFAController } from '../controllers/MFAController';

// Service instances (singletons)
let mfaServiceInstance: MFAService | null = null;
let authServiceInstance: AuthService | null = null;
let userServiceInstance: UserService | null = null;
let auditServiceInstance: AuditService | null = null;
let permissionServiceInstance: PermissionService | null = null;

// Controller instances (singletons)
let authControllerInstance: AuthController | null = null;
let userControllerInstance: UserController | null = null;
let mfaControllerInstance: MFAController | null = null;

/**
 * Get or create MFA service instance
 */
export function getMFAService(): MFAService {
  if (!mfaServiceInstance) {
    mfaServiceInstance = new MFAService();
  }
  return mfaServiceInstance;
}

/**
 * Get or create Auth service instance
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    const mfaService = getMFAService();
    authServiceInstance = new AuthService(mfaService);
  }
  return authServiceInstance;
}

/**
 * Get or create User service instance
 */
export function getUserService(): UserService {
  if (!userServiceInstance) {
    const authService = getAuthService();
    userServiceInstance = new UserService(authService);
  }
  return userServiceInstance;
}

/**
 * Get or create Audit service instance
 */
export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new AuditService();
  }
  return auditServiceInstance;
}

/**
 * Get or create Permission service instance
 */
export function getPermissionService(): PermissionService {
  if (!permissionServiceInstance) {
    permissionServiceInstance = new PermissionService();
  }
  return permissionServiceInstance;
}

/**
 * Get or create Auth controller instance
 */
export function getAuthController(): AuthController {
  if (!authControllerInstance) {
    authControllerInstance = new AuthController(
      getAuthService(),
      getUserService(),
      getAuditService(),
      getPermissionService()
    );
  }
  return authControllerInstance;
}

/**
 * Get or create User controller instance
 */
export function getUserController(): UserController {
  if (!userControllerInstance) {
    userControllerInstance = new UserController(
      getUserService(),
      getAuditService()
    );
  }
  return userControllerInstance;
}

/**
 * Get or create MFA controller instance
 */
export function getMFAController(): MFAController {
  if (!mfaControllerInstance) {
    mfaControllerInstance = new MFAController(
      getMFAService(),
      getPermissionService(),
      getAuthService()
    );
  }
  return mfaControllerInstance;
}

/**
 * Reset all instances (useful for testing)
 */
export function resetInstances(): void {
  mfaServiceInstance = null;
  authServiceInstance = null;
  userServiceInstance = null;
  auditServiceInstance = null;
  permissionServiceInstance = null;
  authControllerInstance = null;
  userControllerInstance = null;
  mfaControllerInstance = null;
}

