import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhooks1734900000000 implements MigrationInterface {
  name = 'AddWebhooks1734900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Webhooks table
    await queryRunner.query(`
      CREATE TABLE "webhooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "url" text NOT NULL,
        "clientId" uuid NOT NULL,
        "events" text[] NOT NULL,
        "secret" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "maxRetries" integer NOT NULL DEFAULT 3,
        "timeoutMs" integer NOT NULL DEFAULT 5000,
        "headers" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_webhooks_client" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX "IDX_webhooks_client_url" ON "webhooks" ("clientId", "url");
      CREATE INDEX "IDX_webhooks_client" ON "webhooks" ("clientId");
    `);

    // Webhook events table
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "webhookId" uuid NOT NULL,
        "eventType" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "attemptCount" integer NOT NULL DEFAULT 0,
        "httpStatus" integer,
        "responseBody" text,
        "errorMessage" text,
        "deliveredAt" timestamp,
        "nextRetryAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_webhook_events_webhook" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_webhook_events_webhook" ON "webhook_events" ("webhookId", "createdAt");
      CREATE INDEX "IDX_webhook_events_status" ON "webhook_events" ("status", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhooks"`);
  }
}

