/**
 * Theme-related types
 */

export interface CreateThemeDto {
  clientId: string | null; // null for global theme
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    [key: string]: string | undefined;
  };
  cssVariables?: Record<string, string>;
  faviconUrl?: string;
  logoUrl?: string;
  themeName?: string;
}

export interface UpdateThemeDto {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    [key: string]: string | undefined;
  };
  cssVariables?: Record<string, string>;
  faviconUrl?: string;
  logoUrl?: string;
  themeName?: string;
}

