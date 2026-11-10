import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import { Plan } from '../../entities/Plan';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Plans API (Super Admin)', () => {
  let superAdminClient: Client;
  let superAdminRole: Role;
  let superAdminUser: User;
  let accessToken: string;

  beforeAll(async () => {
    await AppDataSource.initialize();
    
    // Create super admin client
    const clientRepository = AppDataSource.getRepository(Client);
    superAdminClient = clientRepository.create({
      name: 'Super Admin',
      subdomain: 'superadmin',
      isActive: true,
      allowSuperAdminLogin: true,
    });
    superAdminClient = await clientRepository.save(superAdminClient);

    // Create super admin role
    const roleRepository = AppDataSource.getRepository(Role);
    superAdminRole = roleRepository.create({
      name: 'Super Admin Role',
      clientId: superAdminClient.id,
      isActive: true,
    });
    superAdminRole = await roleRepository.save(superAdminRole);

    // Create super admin user
    const userRepository = AppDataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('SuperAdmin123!', 10);
    superAdminUser = userRepository.create({
      email: 'superadmin@test.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      clientId: superAdminClient.id,
      roleId: superAdminRole.id,
      isActive: true,
      isSuperAdmin: true,
    });
    superAdminUser = await userRepository.save(superAdminUser);

    // Login as super admin using main auth endpoint
    // Use Host header with subdomain to set clientId via subdomain middleware
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Host', `${superAdminClient.subdomain}.localhost:3000`)
      .send({
        email: 'superadmin@test.com',
        password: 'SuperAdmin123!',
      });

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const planRepository = AppDataSource.getRepository(Plan);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ clientId: superAdminClient.id });
    await roleRepository.delete({ id: superAdminRole.id });
    await planRepository.delete({});
    await clientRepository.delete({ id: superAdminClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/plans', () => {
    it('should get list of all plans', async () => {
      const response = await request(app)
        .get('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/plans', () => {
    it('should create a new plan', async () => {
      const newPlan = {
        name: `Test Plan ${Date.now()}`,
        description: 'Test plan description',
        price: 99.99,
        billingPeriod: 'monthly',
        allowedPermissions: {
          users: ['read', 'create', 'update'],
        },
        limits: {
          users: 10,
          storage: 1000,
        },
        databasePermissions: {
          allowedIsolationLevels: ['shared', 'schema'],
          allowCustomTables: true,
        },
      };

      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newPlan)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newPlan.name);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should get plan by id', async () => {
      // Create a plan first
      const planRepository = AppDataSource.getRepository(Plan);
      const testPlan = planRepository.create({
        name: `Test Plan ${Date.now()}`,
        allowedPermissions: {},
        limits: {},
      });
      const savedPlan = await planRepository.save(testPlan);

      const response = await request(app)
        .get(`/api/plans/${savedPlan.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(savedPlan.id);
    });
  });

  describe('PUT /api/plans/:id', () => {
    it('should update plan', async () => {
      // Create a plan first
      const planRepository = AppDataSource.getRepository(Plan);
      const testPlan = planRepository.create({
        name: `Test Plan ${Date.now()}`,
        allowedPermissions: {},
        limits: {},
      });
      const savedPlan = await planRepository.save(testPlan);

      const response = await request(app)
        .put(`/api/plans/${savedPlan.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Plan Name',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Plan Name');
    });
  });

  describe('DELETE /api/plans/:id', () => {
    it('should delete plan', async () => {
      // Create a plan to delete
      const planRepository = AppDataSource.getRepository(Plan);
      const planToDelete = planRepository.create({
        name: `Delete Plan ${Date.now()}`,
        allowedPermissions: {},
        limits: {},
      });
      const savedPlan = await planRepository.save(planToDelete);

      const response = await request(app)
        .delete(`/api/plans/${savedPlan.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

