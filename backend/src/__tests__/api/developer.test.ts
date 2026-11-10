import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Developer API', () => {
  let superAdminClient: Client;
  let superAdminRole: Role;
  let developerUser: User;
  let accessToken: string;

  beforeAll(async () => {
    await AppDataSource.initialize();
    
    const clientRepository = AppDataSource.getRepository(Client);
    superAdminClient = clientRepository.create({
      name: 'Super Admin',
      subdomain: 'superadmin',
      isActive: true,
      allowSuperAdminLogin: true,
    });
    superAdminClient = await clientRepository.save(superAdminClient);

    const roleRepository = AppDataSource.getRepository(Role);
    superAdminRole = roleRepository.create({
      name: 'Developer Role',
      clientId: superAdminClient.id,
      isActive: true,
    });
    superAdminRole = await roleRepository.save(superAdminRole);

    const userRepository = AppDataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('Developer123!', 10);
    developerUser = userRepository.create({
      email: 'developer@test.com',
      passwordHash,
      firstName: 'Developer',
      lastName: 'User',
      clientId: superAdminClient.id,
      roleId: superAdminRole.id,
      isActive: true,
      isDeveloper: true,
    });
    developerUser = await userRepository.save(developerUser);

    // Login as developer using main auth endpoint
    // Use Host header with subdomain to set clientId via subdomain middleware
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Host', `${superAdminClient.subdomain}.localhost:3000`)
      .send({
        email: 'developer@test.com',
        password: 'Developer123!',
      });

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ clientId: superAdminClient.id });
    await roleRepository.delete({ id: superAdminRole.id });
    await clientRepository.delete({ id: superAdminClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/developer/stats', () => {
    it('should get system statistics', async () => {
      const response = await request(app)
        .get('/api/developer/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenants).toBeDefined();
      expect(response.body.data.users).toBeDefined();
    });
  });

  describe('GET /api/developer/tenants', () => {
    it('should get all tenants', async () => {
      const response = await request(app)
        .get('/api/developer/tenants')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.tenants)).toBe(true);
    });
  });
});

