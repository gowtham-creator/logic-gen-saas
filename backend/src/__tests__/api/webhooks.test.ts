import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import { Webhook } from '../../entities/Webhook';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Webhooks API', () => {
  let testClient: Client;
  let testRole: Role;
  let adminUser: User;
  let accessToken: string;

  beforeAll(async () => {
    await AppDataSource.initialize();
    
    // Create test client
    const clientRepository = AppDataSource.getRepository(Client);
    testClient = clientRepository.create({
      name: 'Test Client',
      subdomain: 'testclient',
      isActive: true,
    });
    testClient = await clientRepository.save(testClient);

    // Create test role
    const roleRepository = AppDataSource.getRepository(Role);
    testRole = roleRepository.create({
      name: 'Admin',
      clientId: testClient.id,
      isActive: true,
    });
    testRole = await roleRepository.save(testRole);

    // Create admin user
    const userRepository = AppDataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    adminUser = userRepository.create({
      email: 'admin@test.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      clientId: testClient.id,
      roleId: testRole.id,
      isActive: true,
    });
    adminUser = await userRepository.save(adminUser);

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'Admin123!',
      });

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    const webhookRepository = AppDataSource.getRepository(Webhook);
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await webhookRepository.delete({ clientId: testClient.id });
    await userRepository.delete({ clientId: testClient.id });
    await roleRepository.delete({ id: testRole.id });
    await clientRepository.delete({ id: testClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/webhooks', () => {
    it('should get list of webhooks', async () => {
      const response = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/webhooks', () => {
    it('should create a new webhook', async () => {
      const newWebhook = {
        name: `Test Webhook ${Date.now()}`,
        url: 'https://example.com/webhook',
        events: ['user.created', 'user.updated'],
        secret: 'test-secret',
        isActive: true,
      };

      const response = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newWebhook)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newWebhook.name);
      expect(response.body.data.url).toBe(newWebhook.url);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate URL format', async () => {
      const response = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Webhook',
          url: 'invalid-url',
          events: ['user.created'],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/webhooks/:id', () => {
    it('should get webhook by id', async () => {
      // Create a webhook first
      const webhookRepository = AppDataSource.getRepository(Webhook);
      const testWebhook = webhookRepository.create({
        name: `Test Webhook ${Date.now()}`,
        url: 'https://example.com/webhook',
        events: ['user.created'],
        clientId: testClient.id,
        isActive: true,
      });
      const savedWebhook = await webhookRepository.save(testWebhook);

      const response = await request(app)
        .get(`/api/webhooks/${savedWebhook.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(savedWebhook.id);
    });
  });

  describe('PUT /api/webhooks/:id', () => {
    it('should update webhook', async () => {
      // Create a webhook first
      const webhookRepository = AppDataSource.getRepository(Webhook);
      const testWebhook = webhookRepository.create({
        name: `Test Webhook ${Date.now()}`,
        url: 'https://example.com/webhook',
        events: ['user.created'],
        clientId: testClient.id,
        isActive: true,
      });
      const savedWebhook = await webhookRepository.save(testWebhook);

      const response = await request(app)
        .put(`/api/webhooks/${savedWebhook.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Webhook Name',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Webhook Name');
    });
  });

  describe('DELETE /api/webhooks/:id', () => {
    it('should delete webhook', async () => {
      // Create a webhook first
      const webhookRepository = AppDataSource.getRepository(Webhook);
      const testWebhook = webhookRepository.create({
        name: `Delete Webhook ${Date.now()}`,
        url: 'https://example.com/webhook',
        events: ['user.created'],
        clientId: testClient.id,
        isActive: true,
      });
      const savedWebhook = await webhookRepository.save(testWebhook);

      const response = await request(app)
        .delete(`/api/webhooks/${savedWebhook.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

