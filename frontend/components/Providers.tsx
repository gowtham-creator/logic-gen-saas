'use client';

import { ReactNode } from 'react';
import NotificationProvider from '@/components/NotificationProvider';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PermissionsProvider>
      <ThemeProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </ThemeProvider>
    </PermissionsProvider>
  );
}

