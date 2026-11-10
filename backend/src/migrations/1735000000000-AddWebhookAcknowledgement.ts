import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookAcknowledgement1735000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add acknowledgement fields to webhooks table
    await queryRunner.query(`
      ALTER TABLE "webhooks"
      ADD COLUMN IF NOT EXISTS "acknowledgementRequired" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "acknowledgementTimeoutMs" INTEGER NOT NULL DEFAULT 30000
    `);

    // Add acknowledgement tracking fields to webhook_events table
    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "acknowledgementStatus" VARCHAR,
      ADD COLUMN IF NOT EXISTS "acknowledgementTimeoutAt" TIMESTAMP
    `);

    // Update status enum to include new statuses
    // Note: PostgreSQL doesn't support ALTER TYPE easily, so we'll use VARCHAR
    // The application layer handles the enum validation
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove acknowledgement fields from webhook_events
    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      DROP COLUMN IF EXISTS "acknowledgedAt",
      DROP COLUMN IF EXISTS "acknowledgementStatus",
      DROP COLUMN IF EXISTS "acknowledgementTimeoutAt"
    `);

    // Remove acknowledgement fields from webhooks
    await queryRunner.query(`
      ALTER TABLE "webhooks"
      DROP COLUMN IF EXISTS "acknowledgementRequired",
      DROP COLUMN IF EXISTS "acknowledgementTimeoutMs"
    `);
  }
}

