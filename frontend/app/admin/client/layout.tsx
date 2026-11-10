'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Loader2 } from 'lucide-react';

interface ClientAdminLayoutProps {
  children: React.ReactNode;
}

export default function ClientAdminLayout({ children }: ClientAdminLayoutProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    const auth = isAuthenticated();
    if (!auth) {
      router.push('/login');
      return;
    }
    setIsAuthorized(true);
  }, [router]);

  if (isAuthorized === null) {
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
    return null; // Will be redirected
  }

  return <AdminLayout>{children}</AdminLayout>;
}
