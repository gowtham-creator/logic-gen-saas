'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/constants/routes';
import type { Theme, ThemeContextType } from '@/types';

export type { Theme, ThemeContextType };

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTheme = async () => {
    // Check if we're on a public page (login, reset-password, unauthorized, etc.)
    const isPublicPage = typeof window !== 'undefined' && 
      (window.location.pathname === '/login' || 
       window.location.pathname.startsWith('/login') ||
       window.location.pathname === '/reset-password' ||
       window.location.pathname.startsWith('/reset-password') ||
       window.location.pathname === '/unauthorized' ||
       window.location.pathname.startsWith('/unauthorized'));

    // Use public theme endpoint for public pages if not authenticated
    if (isPublicPage && typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      try {
        setLoading(true);
        // Use public theme endpoint that doesn't require authentication
        const data = await apiClient.get<Theme>(API_ENDPOINTS.THEME.PUBLIC);
        setTheme(data);
        await applyTheme(data);
      } catch (error) {
        console.error('Failed to load public theme:', error);
        // Apply default theme as fallback
        const defaultTheme: Theme = {
          colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            accent: '#10b981',
            background: '#ffffff',
            text: '#1f2937',
          },
          themeName: 'default',
        };
        setTheme(defaultTheme);
        await applyTheme(defaultTheme);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const data = await apiClient.get<Theme>(API_ENDPOINTS.THEME.BASE);
      setTheme(data);
      await applyTheme(data);
    } catch (error) {
      console.error('Failed to load theme:', error);
      // Apply default theme
      const defaultTheme: Theme = {
        colors: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          accent: '#10b981',
          background: '#ffffff',
          text: '#1f2937',
        },
        themeName: 'default',
      };
      setTheme(defaultTheme);
      await applyTheme(defaultTheme);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to darken a color (simple approach)
  const darkenColor = (color: string, percent: number): string => {
    try {
      // Remove # if present and ensure it's a valid hex color
      const hex = color.replace('#', '');
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return color; // Return original if invalid
      }
      const num = parseInt(hex, 16);
      const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - percent)));
      const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - percent)));
      const b = Math.max(0, Math.round((num & 0xff) * (1 - percent)));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch {
      return color; // Return original on error
    }
  };

  // Helper function to lighten a color (simple approach)
  const lightenColor = (color: string, percent: number): string => {
    try {
      const hex = color.replace('#', '');
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return color; // Return original if invalid
      }
      const num = parseInt(hex, 16);
      const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 * percent)));
      const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 * percent)));
      const b = Math.min(255, Math.round((num & 0xff) + (255 * percent)));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch {
      return color; // Return original on error
    }
  };

  // Helper function to fetch authenticated image and convert to blob URL
  const fetchAuthenticatedImage = async (url: string): Promise<string | null> => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        return null;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to fetch authenticated image:', error);
      return null;
    }
  };

  const applyTheme = async (themeData: Theme) => {
    const root = document.documentElement;

    // Apply CSS variables
    if (themeData.cssVariables) {
      Object.entries(themeData.cssVariables).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
    }

    // Apply color variables
    if (themeData.colors) {
      Object.entries(themeData.colors).forEach(([key, value]) => {
        if (value) {
          // Set the base color
          root.style.setProperty(`--color-${key}`, value);
          
          // Generate and set color shades for primary, secondary, and accent
          if (key === 'primary' || key === 'secondary' || key === 'accent') {
            // Set commonly used shades
            root.style.setProperty(`--color-${key}-500`, value); // Base color
            root.style.setProperty(`--color-${key}-600`, darkenColor(value, 0.15)); // Darker
            root.style.setProperty(`--color-${key}-700`, darkenColor(value, 0.25)); // Darker
            root.style.setProperty(`--color-${key}-800`, darkenColor(value, 0.35)); // Darker
            root.style.setProperty(`--color-${key}-400`, lightenColor(value, 0.1)); // Lighter
            root.style.setProperty(`--color-${key}-300`, lightenColor(value, 0.2)); // Lighter
            root.style.setProperty(`--color-${key}-100`, lightenColor(value, 0.4)); // Much lighter
            root.style.setProperty(`--color-${key}-50`, lightenColor(value, 0.45)); // Very light
          }
        }
      });
    }

    // Apply favicon with authentication
    if (themeData.faviconUrl) {
      // Check if it's an API endpoint that requires authentication
      if (themeData.faviconUrl.includes('/api/theme/files/')) {
        const blobUrl = await fetchAuthenticatedImage(themeData.faviconUrl);
        if (blobUrl) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) {
            link.href = blobUrl;
          } else {
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.href = blobUrl;
            document.head.appendChild(newLink);
          }
        }
      } else {
        // Public URL, use directly
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
          link.href = themeData.faviconUrl;
        } else {
          const newLink = document.createElement('link');
          newLink.rel = 'icon';
          newLink.href = themeData.faviconUrl;
          document.head.appendChild(newLink);
        }
      }
    }

    // Apply background color
    if (themeData.colors?.background) {
      document.body.style.backgroundColor = themeData.colors.background;
    }
  };

  useEffect(() => {
    loadTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTheme = async (updates: Partial<Theme>) => {
    try {
      const updated = await apiClient.put<Theme>(API_ENDPOINTS.THEME.BASE, updates);
      setTheme(updated);
      await applyTheme(updated);
    } catch (error) {
      console.error('Failed to update theme:', error);
      throw error;
    }
  };

  const resetTheme = async () => {
    try {
      const reset = await apiClient.post<Theme>(API_ENDPOINTS.THEME.RESET);
      setTheme(reset);
      await applyTheme(reset);
    } catch (error) {
      console.error('Failed to reset theme:', error);
      throw error;
    }
  };

  const uploadFavicon = async (file: File) => {
    try {
      const formData = new FormData();
      console.log('Uploading favicon:', file);
      formData.append('favicon', file);

      const updated = await apiClient.post<Theme>(
        API_ENDPOINTS.THEME.UPLOAD_FAVICON,
        formData
      );
      setTheme(updated);
      await applyTheme(updated);
    } catch (error) {
      console.error('Failed to upload favicon:', error);
      throw error;
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const updated = await apiClient.post<Theme>(
        API_ENDPOINTS.THEME.UPLOAD_LOGO,
        formData
      );
      setTheme(updated);
      await applyTheme(updated);
    } catch (error) {
      console.error('Failed to upload logo:', error);
      throw error;
    }
  };

  const refreshTheme = async () => {
    await loadTheme();
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        loading,
        updateTheme,
        resetTheme,
        uploadFavicon,
        uploadLogo,
        refreshTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

