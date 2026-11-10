import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { SuperAdmin } from '../entities/SuperAdmin';
import { config } from '../config/config';
import { AuthTokens } from '../types/auth.types';
import { AUTH_CONSTANTS } from '../constants/auth';
import { SECURITY_CONSTANTS } from '../constants/security';

export interface SuperAdminLoginDto {
  email: string;
  password: string;
}

export class SuperAdminAuthService {
  private superAdminRepository: Repository<SuperAdmin>;

  constructor() {
    this.superAdminRepository = AppDataSource.getRepository(SuperAdmin);
  }

  async login(data: SuperAdminLoginDto): Promise<{ admin: SuperAdmin; tokens: AuthTokens; mustResetPassword?: boolean }> {
    const admin = await this.superAdminRepository.findOne({
      where: { email: data.email, isActive: true },
      relations: ['role'],
      select: ['id', 'email', 'passwordHash', 'firstName', 'lastName', 'roleId', 'isActive', 'mustResetPassword', 'createdAt', 'updatedAt'],
    });

    if (!admin) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(data.password, admin.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // If admin must reset password, return early without tokens
    if (admin.mustResetPassword) {
      return { admin, tokens: {} as AuthTokens, mustResetPassword: true };
    }

    const tokens = await this.generateTokens(admin);
    await this.saveRefreshToken(admin.id, tokens.refreshToken);

    return { admin, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    let decoded: { adminId: string };
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { adminId: string };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    const admin = await this.superAdminRepository.findOne({
      where: { id: decoded.adminId, isActive: true },
      relations: ['role'],
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    // Verify refresh token matches
    if (admin.refreshToken !== refreshToken || !admin.refreshTokenExpiresAt || admin.refreshTokenExpiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    const tokens = await this.generateTokens(admin);
    await this.saveRefreshToken(admin.id, tokens.refreshToken);

    return tokens;
  }

  async logout(adminId: string): Promise<void> {
    await this.superAdminRepository.update(adminId, {
      refreshToken: undefined,
      refreshTokenExpiresAt: undefined,
    });
  }

  private async generateTokens(admin: SuperAdmin): Promise<AuthTokens> {
    const payload = {
      adminId: admin.id,
      email: admin.email,
      type: 'super_admin',
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ adminId: admin.id, type: 'super_admin' }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    const expiresIn = parseInt(config.jwt.expiresIn.replace('m', '')) * 60; // Convert to seconds

    return { accessToken, refreshToken, expiresIn };
  }

  private async saveRefreshToken(adminId: string, refreshToken: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS);

    await this.superAdminRepository.update(adminId, {
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SECURITY_CONSTANTS.BCRYPT_ROUNDS);
  }
}

