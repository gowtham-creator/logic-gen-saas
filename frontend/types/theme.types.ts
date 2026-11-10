/**
 * Theme-related types
 */

export interface ThemeColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  [key: string]: string | undefined;
}

export interface Theme {
  id?: string;
  clientId?: string;
  colors: ThemeColors;
  cssVariables?: Record<string, string>;
  faviconUrl?: string;
  logoUrl?: string;
  themeName?: string;
}

export interface ThemeContextType {
  theme: Theme | null;
  loading: boolean;
  updateTheme: (updates: Partial<Theme>) => Promise<void>;
  resetTheme: () => Promise<void>;
  uploadFavicon: (file: File) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
  refreshTheme: () => Promise<void>;
}

