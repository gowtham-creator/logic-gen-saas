import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { RolePermission } from '../entities/RolePermission';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '../constants/permissions';
import { logger } from '../utils/logger';
import { config } from '../config/config';

/**
 * Parse PostgreSQL connection URL to extract components
 */
function parseDatabaseUrl(url: string): {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
} {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

/**
 * Seed roles and permissions for a tenant database
 */
async function seedTenantData() {
  const tenantSubdomain = process.argv[2] || 'testtenant';
  const userEmail = process.argv[3] || 'admin@testtenant.com';

  if (!tenantSubdomain) {
    console.error('Usage: tsx src/scripts/seedTenantData.ts <tenantSubdomain> [userEmail]');
    console.error('Example: tsx src/scripts/seedTenantData.ts testtenant admin@testtenant.com');
    process.exit(1);
  }

  try {
    // Get client from shared database
    const { AppDataSource } = await import('../config/database');
    await AppDataSource.initialize();
    
    const { Client } = await import('../entities/Client');
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { subdomain: tenantSubdomain, isActive: true },
    });

    if (!client) {
      logger.error(`Client with subdomain "${tenantSubdomain}" not found`);
      process.exit(1);
    }

    const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
    const dbConfigService = new DatabaseConfigService();
    const dbConfig = await dbConfigService.getClientDatabaseConfig(client.id);

    if (dbConfig.isolationLevel !== 'database') {
      logger.error(`Client "${tenantSubdomain}" is not using database-per-tenant isolation`);
      logger.info('This script is designed for database-per-tenant clients');
      process.exit(1);
    }

    if (!dbConfig.databaseUrl) {
      logger.error(`Database URL not configured for client "${tenantSubdomain}"`);
      process.exit(1);
    }

    // Fix database URL for Docker environment
    let databaseUrl = dbConfig.databaseUrl;
    const mainDatabaseUrl = process.env.DATABASE_URL || '';
    const isDocker = mainDatabaseUrl.includes('@postgres:') || mainDatabaseUrl.includes('@postgres/');
    
    if (isDocker && databaseUrl.includes('@localhost:')) {
      databaseUrl = databaseUrl.replace('@localhost:', '@postgres:');
      logger.info('Adjusted database URL for Docker environment');
    }

    logger.info(`Connecting to tenant database: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);

    // Connect to tenant database (using no entities to avoid Client relation issues)
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: [], // No entities, we'll use raw SQL for everything
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    });

    await tenantDataSource.initialize();
    logger.info('Connected to tenant database');

    // Find user using raw SQL
    const userResult = await tenantDataSource.query(
      `SELECT id, email, "roleId" FROM users WHERE email = $1`,
      [userEmail]
    );

    if (userResult.length === 0) {
      logger.error(`User "${userEmail}" not found in tenant database`);
      await tenantDataSource.destroy();
      await AppDataSource.destroy();
      process.exit(1);
    }

    const user = userResult[0];
    logger.info(`Found user: ${userEmail} (${user.id})`);

    // Make clientId nullable in roles table for database-per-tenant (if not already)
    try {
      await tenantDataSource.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'roles' 
            AND column_name = 'clientId' 
            AND is_nullable = 'NO'
          ) THEN
            ALTER TABLE roles ALTER COLUMN "clientId" DROP NOT NULL;
          END IF;
        END $$;
      `);
      logger.info('✅ Made clientId nullable in roles table');
    } catch (error: any) {
      logger.warn(`⚠️  Could not make clientId nullable in roles table: ${error.message}`);
    }

    // Create all permissions
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
    ];

    // Create permissions using raw SQL
    // Check for existing permission by resource, action, AND elementId
    // This is important because we can have multiple permissions with same resource/action but different elementIds
    const savedPermissions: any[] = [];
    for (const permData of permissions) {
      const existing = await tenantDataSource.query(
        `SELECT id, "elementId", description FROM permissions WHERE resource = $1 AND action = $2 AND ("elementId" = $3 OR ("elementId" IS NULL AND $3 IS NULL))`,
        [permData.resource, permData.action, permData.elementId || null]
      );
      
      if (existing.length === 0) {
        const result = await tenantDataSource.query(
          `INSERT INTO permissions (id, resource, action, "elementId", description, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
           RETURNING id, resource, action, "elementId", description`,
          [permData.resource, permData.action, permData.elementId || null, permData.description || null]
        );
        savedPermissions.push(result[0]);
        logger.info(`Created permission: ${permData.resource}:${permData.action}:${permData.elementId || 'no-element'}`);
      } else {
        // Update elementId if missing
        if (!existing[0].elementId && permData.elementId) {
          await tenantDataSource.query(
            `UPDATE permissions SET "elementId" = $1, "updatedAt" = NOW() WHERE id = $2`,
            [permData.elementId, existing[0].id]
          );
        }
        // Update description if provided and different
        if (permData.description && existing[0].description !== permData.description) {
          await tenantDataSource.query(
            `UPDATE permissions SET description = $1, "updatedAt" = NOW() WHERE id = $2`,
            [permData.description, existing[0].id]
          );
        }
        savedPermissions.push(existing[0]);
      }
    }
    logger.info(`✅ Created/updated ${savedPermissions.length} permissions`);

    // Create admin role using raw SQL
    let adminRoleResult = await tenantDataSource.query(
      `SELECT id FROM roles WHERE name = $1`,
      ['Admin']
    );
    
    let adminRoleId: string;
    if (adminRoleResult.length === 0) {
      const result = await tenantDataSource.query(
        `INSERT INTO roles (id, name, description, "clientId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, NULL, $3, NOW(), NOW())
         RETURNING id`,
        ['Admin', 'Full access administrator role', true]
      );
      adminRoleId = result[0].id;
      logger.info('✅ Created admin role');
    } else {
      adminRoleId = adminRoleResult[0].id;
      logger.info('✅ Admin role already exists');
    }

    // Assign all permissions to admin role
    const existingRolePermissions = await tenantDataSource.query(
      `SELECT "permissionId" FROM role_permissions WHERE "roleId" = $1`,
      [adminRoleId]
    );
    const existingPermissionIds = new Set(
      existingRolePermissions.map((rp: any) => rp.permissionId)
    );

    let newPermissionsCount = 0;
    for (const permission of savedPermissions) {
      if (!existingPermissionIds.has(permission.id)) {
        await tenantDataSource.query(
          `INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, NOW())`,
          [adminRoleId, permission.id]
        );
        newPermissionsCount++;
      }
    }
    logger.info(`✅ Assigned ${newPermissionsCount} new permissions to admin role (${existingRolePermissions.length} already existed)`);

    // Assign admin role to user
    if (user.roleId !== adminRoleId) {
      await tenantDataSource.query(
        `UPDATE users SET "roleId" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [adminRoleId, user.id]
      );
      logger.info(`✅ Assigned admin role to user ${userEmail}`);
    } else {
      logger.info(`✅ User ${userEmail} already has admin role`);
    }

    logger.info('\n✅ Seeding completed successfully!');
    logger.info(`\nUser: ${userEmail}`);
    logger.info(`Role: Admin (with all ${savedPermissions.length} permissions)`);

    await tenantDataSource.destroy();
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    logger.error('Seeding failed', { error });
    console.error(error);
    process.exit(1);
  }
}

seedTenantData();

