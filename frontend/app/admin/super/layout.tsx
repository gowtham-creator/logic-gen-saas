'use client';

import { useSuperAdminAuth } from '@/hooks/useSuperAdminAuth';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Loader2 } from 'lucide-react';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { isAuthorized, isLoading } = useSuperAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Will be redirected by the hook
  }

  return <AdminLayout>{children}</AdminLayout>;
}
