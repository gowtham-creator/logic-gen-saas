import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Theme } from '../entities/Theme';
import { DEFAULTS } from '../constants/defaults';
import { CreateThemeDto, UpdateThemeDto } from '../types/theme.types';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository } from '../utils/tenantRepository';
import { getIsolationLevel, buildWhereClause } from '../utils/isolationHelper';

export class ThemeService {
  private getRepository(req?: TenantRequest, forGlobal = false): Repository<Theme> {
    // Global themes always use shared database
    if (forGlobal || !req) {
      return AppDataSource.getRepository(Theme);
    }
    return req ? getTenantRepository(req, Theme) : AppDataSource.getRepository(Theme);
  }

  async getThemeByClientId(clientId: string | null, req?: TenantRequest): Promise<Theme | null> {
    // Global themes always use shared database
    const repository = this.getRepository(req, clientId === null);
    
    if (clientId === null) {
      return await repository
        .createQueryBuilder('theme')
        .where('theme.clientId IS NULL')
        .getOne();
    }
    
    // For client themes, check isolation level
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, {}, clientId);
    
    return repository.findOne({ where });
  }

  async getGlobalTheme(req?: TenantRequest): Promise<Theme | null> {
    return await this.getThemeByClientId(null, req);
  }

  async getOrCreateGlobalTheme(req?: TenantRequest): Promise<Theme> {
    let theme = await this.getGlobalTheme(req);

    if (!theme) {
      // Create default global theme (always in shared database)
      theme = await this.createTheme({
        clientId: null,
        colors: {
          primary: DEFAULTS.THEME_COLORS.PRIMARY,
          secondary: DEFAULTS.THEME_COLORS.SECONDARY,
          accent: DEFAULTS.THEME_COLORS.ACCENT,
          background: DEFAULTS.THEME_COLORS.BACKGROUND,
          text: DEFAULTS.THEME_COLORS.TEXT,
        },
        cssVariables: {},
        themeName: 'default',
      }, req);
    }

    return theme;
  }

  async getOrCreateTheme(clientId: string, req?: TenantRequest): Promise<Theme> {
    let theme = await this.getThemeByClientId(clientId, req);

    if (!theme) {
      // Get global theme as base (from shared database)
      const globalTheme = await this.getGlobalTheme();
      const baseColors = globalTheme?.colors || {
        primary: DEFAULTS.THEME_COLORS.PRIMARY,
        secondary: DEFAULTS.THEME_COLORS.SECONDARY,
        accent: DEFAULTS.THEME_COLORS.ACCENT,
        background: DEFAULTS.THEME_COLORS.BACKGROUND,
        text: DEFAULTS.THEME_COLORS.TEXT,
      };

      // Create theme with global theme as base
      theme = await this.createTheme({
        clientId,
        colors: baseColors,
        cssVariables: globalTheme?.cssVariables || {},
        faviconUrl: globalTheme?.faviconUrl,
        logoUrl: globalTheme?.logoUrl,
        themeName: globalTheme?.themeName || 'default',
      }, req);
    }

    return theme;
  }

  /**
   * Get merged theme (client theme overrides global theme)
   */
  async getMergedTheme(clientId: string, req?: TenantRequest): Promise<Theme> {
    // Global theme is always from shared database
    const globalTheme = await this.getGlobalTheme();
    // Client theme from tenant database if database-per-tenant
    const clientTheme = await this.getThemeByClientId(clientId, req);

    // If no client theme, return global theme or default
    if (!clientTheme) {
      if (globalTheme) {
        return globalTheme;
      }
      return await this.getOrCreateGlobalTheme(req);
    }

    // Merge: client theme overrides global theme
    const mergedTheme = {
      ...clientTheme,
      colors: {
        ...globalTheme?.colors,
        ...clientTheme.colors,
      },
      cssVariables: {
        ...globalTheme?.cssVariables,
        ...clientTheme.cssVariables,
      },
      faviconUrl: clientTheme.faviconUrl || globalTheme?.faviconUrl,
      logoUrl: clientTheme.logoUrl || globalTheme?.logoUrl,
      themeName: clientTheme.themeName || globalTheme?.themeName || 'default',
    };

    return mergedTheme as Theme;
  }

  async createTheme(data: CreateThemeDto, req?: TenantRequest): Promise<Theme> {
    // Check if theme already exists for this client (or global if clientId is null)
    const existing = await this.getThemeByClientId(data.clientId, req);
    if (existing) {
      // If it exists, return it instead of throwing an error
      return existing;
    }

    const repository = this.getRepository(req, data.clientId === null);
    const isolationLevel = data.clientId ? await getIsolationLevel(req, data.clientId) : 'shared';

    try {
      const themeData: any = {
        colors: data.colors || {
          primary: DEFAULTS.THEME_COLORS.PRIMARY,
          secondary: DEFAULTS.THEME_COLORS.SECONDARY,
          accent: DEFAULTS.THEME_COLORS.ACCENT,
          background: DEFAULTS.THEME_COLORS.BACKGROUND,
          text: DEFAULTS.THEME_COLORS.TEXT,
        },
        cssVariables: data.cssVariables || {},
        faviconUrl: data.faviconUrl,
        logoUrl: data.logoUrl,
        themeName: data.themeName || 'default',
      };
      
      // Only set clientId for shared isolation
      if (data.clientId !== null && isolationLevel !== 'database') {
        themeData.clientId = data.clientId;
      }

      const theme = repository.create(themeData);
      const saved = await repository.save(theme);
      return Array.isArray(saved) ? saved[0] : saved;
    } catch (error: any) {
      // Handle race condition: if another request created the theme between our check and save
      // Check for unique constraint violation (PostgreSQL error code 23505)
      if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
        // Try to fetch the existing theme
        const existingTheme = await this.getThemeByClientId(data.clientId, req);
        if (existingTheme) {
          return existingTheme;
        }
      }
      // Re-throw if it's not a unique constraint error or if we couldn't find the existing theme
      throw error;
    }
  }

  async updateTheme(clientId: string | null, data: UpdateThemeDto, req?: TenantRequest): Promise<Theme> {
    const theme = clientId 
      ? await this.getOrCreateTheme(clientId, req)
      : await this.getOrCreateGlobalTheme(req);

    if (data.colors) {
      theme.colors = { ...theme.colors, ...data.colors };
    }

    if (data.cssVariables) {
      theme.cssVariables = { ...theme.cssVariables, ...data.cssVariables };
    }

    if (data.faviconUrl !== undefined) {
      theme.faviconUrl = data.faviconUrl;
    }

    if (data.logoUrl !== undefined) {
      theme.logoUrl = data.logoUrl;
    }

    if (data.themeName) {
      theme.themeName = data.themeName;
    }

    const repository = this.getRepository(req, clientId === null);
    return await repository.save(theme);
  }

  async deleteTheme(clientId: string | null, req?: TenantRequest): Promise<void> {
    const theme = await this.getThemeByClientId(clientId, req);
    if (theme) {
      const repository = this.getRepository(req, clientId === null);
      await repository.remove(theme);
    }
  }

  async resetTheme(clientId: string | null, req?: TenantRequest): Promise<Theme> {
    const theme = clientId 
      ? await this.getOrCreateTheme(clientId, req)
      : await this.getOrCreateGlobalTheme(req);

    theme.colors = {
      primary: DEFAULTS.THEME_COLORS.PRIMARY,
      secondary: DEFAULTS.THEME_COLORS.SECONDARY,
      accent: DEFAULTS.THEME_COLORS.ACCENT,
      background: DEFAULTS.THEME_COLORS.BACKGROUND,
      text: DEFAULTS.THEME_COLORS.TEXT,
    };
    theme.cssVariables = {};
    theme.faviconUrl = undefined;
    theme.logoUrl = undefined;
    theme.themeName = 'default';

    const repository = this.getRepository(req, clientId === null);
    return await repository.save(theme);
  }
}

