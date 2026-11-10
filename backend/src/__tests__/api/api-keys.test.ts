import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import { ApiKey } from '../../entities/ApiKey';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('API Keys API', () => {
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
    const apiKeyRepository = AppDataSource.getRepository(ApiKey);
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await apiKeyRepository.delete({ clientId: testClient.id });
    await userRepository.delete({ clientId: testClient.id });
    await roleRepository.delete({ id: testRole.id });
    await clientRepository.delete({ id: testClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/api-keys', () => {
    it('should get list of API keys', async () => {
      const response = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key', async () => {
      const newApiKey = {
        name: `Test API Key ${Date.now()}`,
        scopes: ['users:read', 'users:create'],
      };

      const response = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newApiKey)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newApiKey.name);
      expect(response.body.data.key).toBeDefined(); // Key should be shown once
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/api-keys/:id/revoke', () => {
    it('should revoke API key', async () => {
      // Create an API key first
      const apiKeyRepository = AppDataSource.getRepository(ApiKey);
      const testApiKey = apiKeyRepository.create({
        name: `Test Key ${Date.now()}`,
        keyHash: 'hashed_key',
        clientId: testClient.id,
      });
      const savedApiKey = await apiKeyRepository.save(testApiKey);

      const response = await request(app)
        .put(`/api/api-keys/${savedApiKey.id}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should delete API key', async () => {
      // Create an API key first
      const apiKeyRepository = AppDataSource.getRepository(ApiKey);
      const testApiKey = apiKeyRepository.create({
        name: `Delete Key ${Date.now()}`,
        keyHash: 'hashed_key_delete',
        clientId: testClient.id,
      });
      const savedApiKey = await apiKeyRepository.save(testApiKey);

      const response = await request(app)
        .delete(`/api/api-keys/${savedApiKey.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

