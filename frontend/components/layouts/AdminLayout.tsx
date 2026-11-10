'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { isAuthenticated, getStoredUser } from '@/lib/auth';
import Sidebar from '@/app/dashboard/components/Sidebar';
import ModernHeader from './ModernHeader';
import { CreateWorkspaceModal } from '@/app/dashboard/components';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Authentication check
  useEffect(() => {
    setIsClient(true);

    if (typeof window !== 'undefined') {
      const checkAuth = () => {
        const auth = isAuthenticated();
        setIsAuth(auth);

        if (!auth) {
          router.push('/login');
          return;
        }

        const userData = getStoredUser();
        setUser(userData);
      };

      checkAuth();

      const timeout = setTimeout(checkAuth, 100);
      return () => clearTimeout(timeout);
    }
  }, [router]);

  const handleCreateWorkflow = async (name: string) => {
    try {
      const newWorkflow = await apiClient.post('/api/workflows', {
        name,
        description: '',
        isActive: true,
      });

      notificationService.success('Workflow created successfully');
      setIsCreateModalOpen(false);

      // Redirect to dashboard to see the new workflow
      router.push('/dashboard');
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to create workflow');
    }
  };

  // Show loading state during SSR and initial client render
  if (!isClient || !isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F8F8]">
      {/* Sidebar */}
      <Sidebar onCreateWorkspace={() => setIsCreateModalOpen(true)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <ModernHeader />

        {/* Main Content Area with Scroll */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[1400px] w-full mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <CreateWorkspaceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateWorkflow}
        />
      )}
    </div>
  );
}
