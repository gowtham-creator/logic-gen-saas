import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Authentication API', () => {
  let testClient: Client;
  let testRole: Role;
  let testUser: User;

  beforeAll(async () => {
    await AppDataSource.initialize();
    
    // Create test client
    const clientRepository = AppDataSource.getRepository(Client);
    testClient = clientRepository.create({
      name: 'Test Client',
      subdomain: 'testclient',
      isActive: true,
      allowSuperAdminLogin: false,
    });
    testClient = await clientRepository.save(testClient);

    // Create test role
    const roleRepository = AppDataSource.getRepository(Role);
    testRole = roleRepository.create({
      name: 'Test Admin',
      clientId: testClient.id,
      isActive: true,
    });
    testRole = await roleRepository.save(testRole);

    // Create test user
    const userRepository = AppDataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    testUser = userRepository.create({
      email: 'testuser@example.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      clientId: testClient.id,
      roleId: testRole.id,
      isActive: true,
      mustResetPassword: false,
    });
    testUser = await userRepository.save(testUser);
  });

  afterAll(async () => {
    // Cleanup
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ id: testUser.id });
    await roleRepository.delete({ id: testRole.id });
    await clientRepository.delete({ id: testClient.id });
    
    await AppDataSource.destroy();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOGIN_ERROR');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // First login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123!',
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123!',
        });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

