import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Audit Logs API', () => {
  let testClient: Client;
  let testRole: Role;
  let adminUser: User;
  let accessToken: string;

  beforeAll(async () => {
    await AppDataSource.initialize();
    
    const clientRepository = AppDataSource.getRepository(Client);
    testClient = clientRepository.create({
      name: 'Test Client',
      subdomain: 'testclient',
      isActive: true,
    });
    testClient = await clientRepository.save(testClient);

    const roleRepository = AppDataSource.getRepository(Role);
    testRole = roleRepository.create({
      name: 'Admin',
      clientId: testClient.id,
      isActive: true,
    });
    testRole = await roleRepository.save(testRole);

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

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'Admin123!',
      });

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ clientId: testClient.id });
    await roleRepository.delete({ id: testRole.id });
    await clientRepository.delete({ id: testClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/audit-logs', () => {
    it('should get list of audit logs', async () => {
      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter audit logs by action', async () => {
      const response = await request(app)
        .get('/api/audit-logs?action=user.created')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

