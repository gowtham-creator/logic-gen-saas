import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { RolePermission } from '../entities/RolePermission';
import { ClientSettings } from '../entities/ClientSettings';
import { Theme } from '../entities/Theme';
import { Plan } from '../entities/Plan';
import { SuperAdmin } from '../entities/SuperAdmin';
import { SuperAdminRole } from '../entities/SuperAdminRole';
import { AuthService } from '../services/AuthService';
import { SuperAdminAuthService } from '../services/SuperAdminAuthService';
import { logger } from '../utils/logger';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '../constants/permissions';
import { DEFAULTS } from '../constants/defaults';
import { PLAN_DATABASE_PERMISSIONS } from '../types/database.types';

async function seed() {
  try {
    await AppDataSource.initialize();
    logger.info('Database connected for seeding');

    const clientRepository = AppDataSource.getRepository(Client);
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
    const clientSettingsRepository = AppDataSource.getRepository(ClientSettings);
    const themeRepository = AppDataSource.getRepository(Theme);
    const planRepository = AppDataSource.getRepository(Plan);
    const superAdminRepository = AppDataSource.getRepository(SuperAdmin);
    const superAdminRoleRepository = AppDataSource.getRepository(SuperAdminRole);
    const authService = new AuthService();
    const superAdminAuthService = new SuperAdminAuthService();

        // Create superadmin client (for super admin login)
        let superAdminClient = await clientRepository.findOne({ where: { subdomain: 'superadmin' } });
        if (!superAdminClient) {
          superAdminClient = clientRepository.create({
            name: 'Super Admin',
            subdomain: 'superadmin',
            isActive: true,
            allowSuperAdminLogin: true,
          });
          superAdminClient = await clientRepository.save(superAdminClient);
          logger.info('Created superadmin client');
        } else {
          // Update existing superadmin client to enable the flag
          if (!superAdminClient.allowSuperAdminLogin) {
            superAdminClient.allowSuperAdminLogin = true;
            superAdminClient = await clientRepository.save(superAdminClient);
            logger.info('Updated superadmin client to allow super admin login');
          }
        }

        // Create default client
        let client = await clientRepository.findOne({ where: { subdomain: DEFAULTS.DEFAULT_CLIENT_SUBDOMAIN } });
        if (!client) {
          client = clientRepository.create({
            name: DEFAULTS.DEFAULT_CLIENT_NAME,
            subdomain: DEFAULTS.DEFAULT_CLIENT_SUBDOMAIN,
            isActive: true,
            allowSuperAdminLogin: false,
          });
          client = await clientRepository.save(client);
          logger.info('Created default client');
        }

        // Create permissions with common UI element IDs
        const permissions = [
          { resource: PERMISSION_RESOURCES.ROLE, action: PERMISSION_ACTIONS.CREATE, description: 'Create roles', elementId: ELEMENT_IDS.BTN_CREATE_ROLE },
          { resource: PERMISSION_RESOURCES.ROLE, action: PERMISSION_ACTIONS.READ, description: 'Read roles', elementId: ELEMENT_IDS.SIDEBAR_ROLES },
          { resource: PERMISSION_RESOURCES.ROLE, action: PERMISSION_ACTIONS.UPDATE, description: 'Update roles', elementId: ELEMENT_IDS.BTN_EDIT_ROLE },
          { resource: PERMISSION_RESOURCES.ROLE, action: PERMISSION_ACTIONS.DELETE, description: 'Delete roles', elementId: ELEMENT_IDS.BTN_DELETE_ROLE },
          { resource: PERMISSION_RESOURCES.ROLE_TEMPLATE, action: PERMISSION_ACTIONS.CREATE, description: 'Create role templates', elementId: ELEMENT_IDS.BTN_CREATE_TEMPLATE },
          { resource: PERMISSION_RESOURCES.ROLE_TEMPLATE, action: PERMISSION_ACTIONS.READ, description: 'Read role templates', elementId: ELEMENT_IDS.SIDEBAR_TEMPLATES },
          { resource: PERMISSION_RESOURCES.ROLE_TEMPLATE, action: PERMISSION_ACTIONS.UPDATE, description: 'Update role templates', elementId: ELEMENT_IDS.BTN_EDIT_TEMPLATE },
          { resource: PERMISSION_RESOURCES.ROLE_TEMPLATE, action: PERMISSION_ACTIONS.DELETE, description: 'Delete role templates', elementId: ELEMENT_IDS.BTN_DELETE_TEMPLATE },
          { resource: PERMISSION_RESOURCES.USER, action: PERMISSION_ACTIONS.CREATE, description: 'Create users', elementId: ELEMENT_IDS.BTN_CREATE_USER },
          { resource: PERMISSION_RESOURCES.USER, action: PERMISSION_ACTIONS.READ, description: 'Read users', elementId: ELEMENT_IDS.SIDEBAR_USERS },
          { resource: PERMISSION_RESOURCES.USER, action: PERMISSION_ACTIONS.UPDATE, description: 'Update users', elementId: ELEMENT_IDS.BTN_EDIT_USER },
          { resource: PERMISSION_RESOURCES.USER, action: PERMISSION_ACTIONS.UPDATE, description: 'Change user password', elementId: ELEMENT_IDS.BTN_CHANGE_PASSWORD },
          { resource: PERMISSION_RESOURCES.USER, action: PERMISSION_ACTIONS.UPDATE, description: 'Toggle user status (activate/deactivate)', elementId: ELEMENT_IDS.BTN_TOGGLE_USER_STATUS },
          { resource: PERMISSION_RESOURCES.USER, action: PERMISSION_ACTIONS.DELETE, description: 'Delete users', elementId: ELEMENT_IDS.BTN_DELETE_USER },
          { resource: PERMISSION_RESOURCES.API_KEY, action: PERMISSION_ACTIONS.CREATE, description: 'Create API keys', elementId: ELEMENT_IDS.BTN_CREATE_API_KEY },
          { resource: PERMISSION_RESOURCES.API_KEY, action: PERMISSION_ACTIONS.READ, description: 'Read API keys', elementId: ELEMENT_IDS.SIDEBAR_API_KEYS },
          { resource: PERMISSION_RESOURCES.API_KEY, action: PERMISSION_ACTIONS.UPDATE, description: 'Update API keys', elementId: ELEMENT_IDS.BTN_EDIT_API_KEY },
          { resource: PERMISSION_RESOURCES.API_KEY, action: PERMISSION_ACTIONS.DELETE, description: 'Delete API keys', elementId: ELEMENT_IDS.BTN_DELETE_API_KEY },
          { resource: PERMISSION_RESOURCES.WEBHOOK, action: PERMISSION_ACTIONS.CREATE, description: 'Create webhooks', elementId: ELEMENT_IDS.BTN_CREATE_WEBHOOK },
          { resource: PERMISSION_RESOURCES.WEBHOOK, action: PERMISSION_ACTIONS.READ, description: 'Read webhooks', elementId: ELEMENT_IDS.SIDEBAR_WEBHOOKS },
          { resource: PERMISSION_RESOURCES.WEBHOOK, action: PERMISSION_ACTIONS.UPDATE, description: 'Update webhooks', elementId: ELEMENT_IDS.BTN_EDIT_WEBHOOK },
          { resource: PERMISSION_RESOURCES.WEBHOOK, action: PERMISSION_ACTIONS.DELETE, description: 'Delete webhooks', elementId: ELEMENT_IDS.BTN_DELETE_WEBHOOK },
          { resource: PERMISSION_RESOURCES.CLIENT_SETTINGS, action: PERMISSION_ACTIONS.READ, description: 'Read client settings', elementId: ELEMENT_IDS.PAGE_CLIENT_SETTINGS },
          { resource: PERMISSION_RESOURCES.CLIENT_SETTINGS, action: PERMISSION_ACTIONS.UPDATE, description: 'Update client settings', elementId: ELEMENT_IDS.BTN_SAVE_SETTINGS },
          { resource: PERMISSION_RESOURCES.THEME, action: PERMISSION_ACTIONS.READ, description: 'Read theme', elementId: ELEMENT_IDS.SIDEBAR_THEME },
          { resource: PERMISSION_RESOURCES.THEME, action: PERMISSION_ACTIONS.UPDATE, description: 'Update theme', elementId: ELEMENT_IDS.BTN_SAVE_THEME },
          { resource: PERMISSION_RESOURCES.AUDIT_LOG, action: PERMISSION_ACTIONS.READ, description: 'Read audit logs', elementId: ELEMENT_IDS.SIDEBAR_AUDIT },
          { resource: PERMISSION_RESOURCES.PERMISSION, action: PERMISSION_ACTIONS.READ, description: 'Read permissions', elementId: ELEMENT_IDS.SIDEBAR_PERMISSIONS },
          { resource: PERMISSION_RESOURCES.PERMISSION, action: PERMISSION_ACTIONS.UPDATE, description: 'Update permissions', elementId: ELEMENT_IDS.BTN_EDIT_PERMISSION },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.CREATE, description: 'Create workflows', elementId: ELEMENT_IDS.BTN_CREATE_WORKFLOW },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.READ, description: 'Read workflows', elementId: ELEMENT_IDS.SIDEBAR_WORKFLOWS },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.UPDATE, description: 'Update workflows', elementId: ELEMENT_IDS.BTN_EDIT_WORKFLOW },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.DELETE, description: 'Delete workflows', elementId: ELEMENT_IDS.BTN_DELETE_WORKFLOW },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.READ, description: 'View workflow files', elementId: ELEMENT_IDS.BTN_VIEW_WORKFLOW_FILES },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.READ, description: 'Download workflow files', elementId: ELEMENT_IDS.BTN_DOWNLOAD_WORKFLOW_FILE },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.CREATE, description: 'Upload workflow files', elementId: ELEMENT_IDS.BTN_UPLOAD_WORKFLOW_FILE },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.DELETE, description: 'Delete workflow files', elementId: ELEMENT_IDS.BTN_DELETE_WORKFLOW_FILE },
          { resource: PERMISSION_RESOURCES.WORKFLOW, action: PERMISSION_ACTIONS.UPDATE, description: 'Toggle workflow status (activate/deactivate)', elementId: ELEMENT_IDS.BTN_TOGGLE_WORKFLOW_STATUS },
          { resource: PERMISSION_RESOURCES.USER, action: PERMISSION_ACTIONS.MFA_RESET, description: 'Reset user MFA', elementId: ELEMENT_IDS.BTN_RESET_MFA },
        ];

    const savedPermissions: Permission[] = [];
    for (const permData of permissions) {
      // Check for existing permission by resource, action, AND elementId
      // This is important because we can have multiple permissions with same resource/action but different elementIds
      let perm = await permissionRepository.findOne({
        where: { 
          resource: permData.resource, 
          action: permData.action,
          elementId: permData.elementId || null,
        },
      });
      if (!perm) {
        perm = permissionRepository.create(permData);
        perm = await permissionRepository.save(perm);
      } else {
        // Update elementId if it's missing or if we're updating to sidebar elementIds for read permissions
        const shouldUpdate = !perm.elementId || 
          (permData.elementId && permData.elementId.startsWith('sidebar-') && perm.elementId !== permData.elementId);
        if (shouldUpdate && permData.elementId) {
          perm.elementId = permData.elementId;
          perm = await permissionRepository.save(perm);
        }
        // Update description if provided
        if (permData.description && perm.description !== permData.description) {
          perm.description = permData.description;
          perm = await permissionRepository.save(perm);
        }
      }
      savedPermissions.push(perm);
    }
    logger.info(`Created ${savedPermissions.length} permissions`);

        // Create admin role
        let adminRole = await roleRepository.findOne({
          where: { name: DEFAULTS.ADMIN_ROLE_NAME, clientId: client.id },
        });
        if (!adminRole) {
          adminRole = roleRepository.create({
            name: DEFAULTS.ADMIN_ROLE_NAME,
            description: DEFAULTS.ADMIN_ROLE_DESCRIPTION,
            clientId: client.id,
            isActive: true,
          });
          adminRole = await roleRepository.save(adminRole);
          logger.info('Created admin role');
        }

    // Assign all permissions to admin role (including new ones)
    const existingRolePermissions = await rolePermissionRepository.find({
      where: { roleId: adminRole.id },
    });
    const existingPermissionIds = new Set(
      existingRolePermissions.map((rp) => rp.permissionId)
    );

    for (const permission of savedPermissions) {
      if (!existingPermissionIds.has(permission.id)) {
        const rolePermission = rolePermissionRepository.create({
          roleId: adminRole.id,
          permissionId: permission.id,
        });
        await rolePermissionRepository.save(rolePermission);
      }
    }
    logger.info('Assigned all permissions to admin role');

        // Create super admin user
        let adminUser = await userRepository.findOne({
          where: { email: DEFAULTS.ADMIN_EMAIL, clientId: client.id },
        });
        if (!adminUser) {
          const passwordHash = await authService.hashPassword(DEFAULTS.ADMIN_PASSWORD);
          adminUser = userRepository.create({
            email: DEFAULTS.ADMIN_EMAIL,
            passwordHash,
            firstName: DEFAULTS.ADMIN_FIRST_NAME,
            lastName: DEFAULTS.ADMIN_LAST_NAME,
            clientId: client.id,
            roleId: adminRole.id,
            isActive: true,
          });
          adminUser = await userRepository.save(adminUser);
          logger.info(`Created admin user: ${DEFAULTS.ADMIN_EMAIL} / ${DEFAULTS.ADMIN_PASSWORD}`);
        }

        // Create client settings
        let clientSettings = await clientSettingsRepository.findOne({
          where: { clientId: client.id },
        });
        if (!clientSettings) {
          clientSettings = clientSettingsRepository.create({
            clientId: client.id,
            featureToggles: DEFAULTS.FEATURE_TOGGLES,
            settings: {},
          });
          await clientSettingsRepository.save(clientSettings);
          logger.info('Created client settings');
        }

        // Create theme
        let theme = await themeRepository.findOne({
          where: { clientId: client.id },
        });
        if (!theme) {
          theme = themeRepository.create({
            clientId: client.id,
            colors: DEFAULTS.THEME_COLORS,
            cssVariables: {
              '--color-primary': DEFAULTS.THEME_COLORS.PRIMARY,
              '--color-secondary': DEFAULTS.THEME_COLORS.SECONDARY,
              '--color-accent': DEFAULTS.THEME_COLORS.ACCENT,
            },
          });
          await themeRepository.save(theme);
          logger.info('Created default theme');
        }

    // Create sample plans
    const plans = [
      {
        name: DEFAULTS.PLANS.BASIC.NAME,
        description: DEFAULTS.PLANS.BASIC.DESCRIPTION,
        price: DEFAULTS.PLANS.BASIC.PRICE,
        billingPeriod: DEFAULTS.PLANS.BASIC.BILLING_PERIOD,
        allowedPermissions: {
          [PERMISSION_RESOURCES.USER]: [PERMISSION_ACTIONS.READ],
          [PERMISSION_RESOURCES.ROLE]: [PERMISSION_ACTIONS.READ],
          [PERMISSION_RESOURCES.API_KEY]: [PERMISSION_ACTIONS.READ],
        },
        limits: { users: 5, apiKeys: 2 },
        databasePermissions: PLAN_DATABASE_PERMISSIONS.basic,
        isActive: true,
      },
      {
        name: DEFAULTS.PLANS.PROFESSIONAL.NAME,
        description: DEFAULTS.PLANS.PROFESSIONAL.DESCRIPTION,
        price: DEFAULTS.PLANS.PROFESSIONAL.PRICE,
        billingPeriod: DEFAULTS.PLANS.PROFESSIONAL.BILLING_PERIOD,
        allowedPermissions: {
          [PERMISSION_RESOURCES.USER]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.CREATE, PERMISSION_ACTIONS.UPDATE],
          [PERMISSION_RESOURCES.ROLE]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.CREATE, PERMISSION_ACTIONS.UPDATE],
          [PERMISSION_RESOURCES.API_KEY]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.CREATE, PERMISSION_ACTIONS.UPDATE],
          [PERMISSION_RESOURCES.CLIENT_SETTINGS]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.UPDATE],
          [PERMISSION_RESOURCES.THEME]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.UPDATE],
        },
        limits: { users: 50, apiKeys: 10 },
        databasePermissions: PLAN_DATABASE_PERMISSIONS.professional,
        isActive: true,
      },
      {
        name: DEFAULTS.PLANS.ENTERPRISE.NAME,
        description: DEFAULTS.PLANS.ENTERPRISE.DESCRIPTION,
        price: DEFAULTS.PLANS.ENTERPRISE.PRICE,
        billingPeriod: DEFAULTS.PLANS.ENTERPRISE.BILLING_PERIOD,
        allowedPermissions: {
          [PERMISSION_RESOURCES.USER]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.CREATE, PERMISSION_ACTIONS.UPDATE, PERMISSION_ACTIONS.DELETE],
          [PERMISSION_RESOURCES.ROLE]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.CREATE, PERMISSION_ACTIONS.UPDATE, PERMISSION_ACTIONS.DELETE],
          [PERMISSION_RESOURCES.API_KEY]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.CREATE, PERMISSION_ACTIONS.UPDATE, PERMISSION_ACTIONS.DELETE],
          [PERMISSION_RESOURCES.CLIENT_SETTINGS]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.UPDATE],
          [PERMISSION_RESOURCES.THEME]: [PERMISSION_ACTIONS.READ, PERMISSION_ACTIONS.UPDATE],
          [PERMISSION_RESOURCES.AUDIT_LOG]: [PERMISSION_ACTIONS.READ],
        },
        limits: { users: 1000, apiKeys: 100 },
        databasePermissions: PLAN_DATABASE_PERMISSIONS.enterprise,
        isActive: true,
      },
    ];

    for (const planData of plans) {
      let plan = await planRepository.findOne({
        where: { name: planData.name },
      });
      if (!plan) {
        plan = planRepository.create(planData);
        plan = await planRepository.save(plan);
        logger.info(`Created plan: ${plan.name}`);
      }
    }

    // Create super admin user in superadmin client
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
    
    // Find or create admin role for superadmin client
    let superAdminClientRole = await roleRepository.findOne({
      where: { name: DEFAULTS.ADMIN_ROLE_NAME, clientId: superAdminClient.id },
    });
    if (!superAdminClientRole) {
      superAdminClientRole = roleRepository.create({
        name: DEFAULTS.ADMIN_ROLE_NAME,
        description: 'Full access administrator role for super admin',
        clientId: superAdminClient.id,
        isActive: true,
      });
      superAdminClientRole = await roleRepository.save(superAdminClientRole);
      logger.info('Created admin role for superadmin client');
      
      // Assign all permissions to superadmin client role
      for (const permission of savedPermissions) {
        const rolePermission = rolePermissionRepository.create({
          roleId: superAdminClientRole.id,
          permissionId: permission.id,
        });
        await rolePermissionRepository.save(rolePermission);
      }
      logger.info('Assigned all permissions to superadmin client admin role');
    }
    
    // Create super admin user in superadmin client
    let superAdminUser = await userRepository.findOne({
      where: { email: superAdminEmail, clientId: superAdminClient.id },
    });
    if (!superAdminUser) {
      const passwordHash = await authService.hashPassword(superAdminPassword);
      superAdminUser = userRepository.create({
        email: superAdminEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        clientId: superAdminClient.id,
        roleId: superAdminClientRole.id,
        isActive: true,
        mustResetPassword: false,
        isSuperAdmin: true, // Set super admin flag
      });
      superAdminUser = await userRepository.save(superAdminUser);
      logger.info(`Created super admin user: ${superAdminEmail}`);
      logger.info(`Default password: ${superAdminPassword} (please change after first login)`);
    } else {
      // Update existing user to ensure isSuperAdmin flag is set
      if (!superAdminUser.isSuperAdmin) {
        superAdminUser.isSuperAdmin = true;
        superAdminUser = await userRepository.save(superAdminUser);
        logger.info(`Updated user ${superAdminEmail} to super admin`);
      }
    }

    // Create client settings for superadmin client
    let superAdminClientSettings = await clientSettingsRepository.findOne({
      where: { clientId: superAdminClient.id },
    });
    if (!superAdminClientSettings) {
      superAdminClientSettings = clientSettingsRepository.create({
        clientId: superAdminClient.id,
        featureToggles: DEFAULTS.FEATURE_TOGGLES,
        settings: {},
      });
      await clientSettingsRepository.save(superAdminClientSettings);
      logger.info('Created client settings for superadmin client');
    }

    // Create developer user in superadmin client
    const developerEmail = process.env.DEVELOPER_EMAIL || 'developer@example.com';
    const developerPassword = process.env.DEVELOPER_PASSWORD || 'Developer123!';
    
    let developerUser = await userRepository.findOne({
      where: { email: developerEmail, clientId: superAdminClient.id },
    });
    if (!developerUser) {
      const passwordHash = await authService.hashPassword(developerPassword);
      developerUser = userRepository.create({
        email: developerEmail,
        passwordHash,
        firstName: 'Developer',
        lastName: 'User',
        clientId: superAdminClient.id,
        roleId: superAdminClientRole.id, // Use same admin role
        isActive: true,
        mustResetPassword: false,
        isDeveloper: true, // Mark as developer
      });
      developerUser = await userRepository.save(developerUser);
      logger.info(`Created developer user: ${developerEmail}`);
      logger.info(`Default password: ${developerPassword} (please change after first login)`);
    } else {
      // Update existing user to ensure isDeveloper flag is set
      if (!developerUser.isDeveloper) {
        developerUser.isDeveloper = true;
        developerUser = await userRepository.save(developerUser);
        logger.info(`Updated user ${developerEmail} to developer`);
      }
    }

    logger.info('Seeding completed successfully');
  } catch (error) {
    logger.error('Seeding failed', { error });
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

