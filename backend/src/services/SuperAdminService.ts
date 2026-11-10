import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { SuperAdmin } from '../entities/SuperAdmin';
import { SuperAdminAuthService } from './SuperAdminAuthService';

export interface CreateSuperAdminDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleId?: string;
  isActive?: boolean;
}

export interface UpdateSuperAdminDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
  isActive?: boolean;
  mustResetPassword?: boolean;
}

export class SuperAdminService {
  private superAdminRepository: Repository<SuperAdmin>;
  private authService: SuperAdminAuthService;

  constructor() {
    this.superAdminRepository = AppDataSource.getRepository(SuperAdmin);
    this.authService = new SuperAdminAuthService();
  }

  async createSuperAdmin(data: CreateSuperAdminDto): Promise<SuperAdmin> {
    // Check if email already exists (excluding soft-deleted)
    const existing = await this.superAdminRepository.findOne({
      where: { email: data.email, deletedAt: IsNull() },
    });

    if (existing) {
      throw new Error('Super admin with this email already exists');
    }

    const passwordHash = await this.authService.hashPassword(data.password);

    const admin = this.superAdminRepository.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      roleId: data.roleId,
      isActive: data.isActive ?? true,
      mustResetPassword: false,
    });

    return await this.superAdminRepository.save(admin);
  }

  async updateSuperAdmin(id: string, data: UpdateSuperAdminDto): Promise<SuperAdmin> {
    const admin = await this.superAdminRepository.findOne({ where: { id, deletedAt: IsNull() } });

    if (!admin) {
      throw new Error('Super admin not found');
    }

    // Check if email is being changed and if it's already taken (excluding soft-deleted)
    if (data.email && data.email !== admin.email) {
      const existing = await this.superAdminRepository.findOne({
        where: { email: data.email, deletedAt: IsNull() },
      });

      if (existing) {
        throw new Error('Super admin with this email already exists');
      }
    }

    // Hash password if provided
    if (data.password) {
      data.password = await this.authService.hashPassword(data.password);
      // Rename to passwordHash for update
      (data as any).passwordHash = data.password;
      delete (data as any).password;
    }

    Object.assign(admin, data);
    return await this.superAdminRepository.save(admin);
  }

  async deleteSuperAdmin(id: string): Promise<void> {
    const admin = await this.superAdminRepository.findOne({ where: { id, deletedAt: IsNull() } });

    if (!admin) {
      throw new Error('Super admin not found');
    }

    // Soft delete (set deletedAt)
    await this.superAdminRepository.update({ id }, { deletedAt: new Date() });
  }

  async getSuperAdmin(id: string): Promise<SuperAdmin | null> {
    return await this.superAdminRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['role'],
    });
  }

  async listSuperAdmins(): Promise<SuperAdmin[]> {
    return await this.superAdminRepository.find({
      where: { deletedAt: IsNull() },
      relations: ['role'],
      order: { createdAt: 'DESC' },
    });
  }

  async activateSuperAdmin(id: string): Promise<SuperAdmin> {
    const admin = await this.getSuperAdmin(id);
    if (!admin) {
      throw new Error('Super admin not found');
    }

    admin.isActive = true;
    return await this.superAdminRepository.save(admin);
  }

  async deactivateSuperAdmin(id: string): Promise<SuperAdmin> {
    const admin = await this.getSuperAdmin(id);
    if (!admin) {
      throw new Error('Super admin not found');
    }

    admin.isActive = false;
    return await this.superAdminRepository.save(admin);
  }
}

