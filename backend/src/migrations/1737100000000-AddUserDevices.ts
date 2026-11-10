import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDevices1737100000000 implements MigrationInterface {
  name = 'AddUserDevices1737100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    // Create user_devices table (exists in both shared and tenant databases)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_devices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "deviceId" varchar NOT NULL,
        "clientDeviceId" varchar,
        "deviceName" varchar NOT NULL,
        "deviceType" varchar NOT NULL,
        "browser" varchar NOT NULL,
        "os" varchar NOT NULL,
        "ipAddress" varchar,
        "lastSeenAt" timestamp NOT NULL DEFAULT now(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "isActive" boolean NOT NULL DEFAULT true
      );
    `);

    // Create indexes for fast lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_devices_userId" 
      ON "user_devices" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_devices_deviceId" 
      ON "user_devices" ("deviceId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_devices_clientDeviceId" 
      ON "user_devices" ("clientDeviceId") 
      WHERE "clientDeviceId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_devices_userId_clientDeviceId" 
      ON "user_devices" ("userId", "clientDeviceId") 
      WHERE "clientDeviceId" IS NOT NULL AND "isActive" = true;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_devices_userId_deviceId" 
      ON "user_devices" ("userId", "deviceId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_devices_isActive" 
      ON "user_devices" ("isActive") 
      WHERE "isActive" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_devices_isActive";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_devices_userId_deviceId";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_devices_userId_clientDeviceId";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_devices_clientDeviceId";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_devices_deviceId";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_devices_userId";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_devices";
    `);
  }

  private async isTenantDatabase(queryRunner: QueryRunner): Promise<boolean> {
    try {
      const result = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'clients'
        ) as exists;
      `);
      return !result[0]?.exists;
    } catch {
      return false;
    }
  }
}

