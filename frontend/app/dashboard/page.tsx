// app/dashboard/page.tsx or components/DashboardPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import { isAuthenticated, getStoredUser } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardStats from './components/DashboardStats';
import ProjectGrid from './components/ProjectGrid';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import WorkspaceView from './workspace/WorkspaceView';
import { CreateWorkspaceModal, EditWorkspaceModal } from './components';
import ViewWorkflowModal from './components/ViewWorkspaceModal';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isActive: boolean;
  createdUser?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);


  // Auth + Load Workflows
  useEffect(() => {
    setIsClient(true);

    if (typeof window === 'undefined') return;

    const checkAuthAndLoad = async () => {
      const auth = isAuthenticated();
      setIsAuth(auth);

      if (!auth) {
        router.push('/login');
        return;
      }

      const userData = getStoredUser();
      setUser(userData);

      // Fetch real workflows from API
      try {
        setLoading(true);
        const data = await apiClient.get<Workflow[]>('/api/workflows');
        setWorkflows(data);
      } catch (error: any) {
        console.error('Failed to load workflows:', error);
        notificationService.error('Failed to load workflows');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [router]);

  const handleCreateWorkflow = async (name: string, description?: string) => {
    try {
      const newWorkflow = await apiClient.post<Workflow>('/api/workflows', {
        name,
        description: description || '',
        isActive: true,
      });

      setWorkflows([...workflows, newWorkflow]);
      notificationService.success('Workflow created successfully');
      setIsCreateModalOpen(false);
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to create workflow');
    }
  };

  const handleOpenWorkflow = (id: string) => {
    const workflow = workflows.find((w) => w.id === id);
    if (workflow) {
      setActiveWorkflow(workflow);
    }
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setIsEditModalOpen(true);
  };

  const handleUpdateWorkflow = async (name: string, description?: string) => {
    if (!selectedWorkflow) return;

    try {
      const updated = await apiClient.put<Workflow>(`/api/workflows/${selectedWorkflow.id}`, {
        name,
        description: description || '',
      });

      setWorkflows(workflows.map((w) => (w.id === selectedWorkflow.id ? updated : w)));
      notificationService.success('Workflow updated');
      setIsEditModalOpen(false);
      setSelectedWorkflow(null);
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to update workflow');
    }
  };

  const handleDeleteClick = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setIsDeleteModalOpen(true);
  };

  const handleViewDetails = (id: string) => {
    const workflow = workflows.find((w) => w.id === id);
    if (workflow) {
      setSelectedWorkflow(workflow);
      setIsViewModalOpen(true);
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedWorkflow) return;

    try {
      await apiClient.delete(`/api/workflows/${selectedWorkflow.id}`);
      setWorkflows(workflows.filter((w) => w.id !== selectedWorkflow.id));
      notificationService.success('Workflow deleted');
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to delete workflow');
    } finally {
      setIsDeleteModalOpen(false);
      setSelectedWorkflow(null);
    }
  };

  const handleBackToDashboard = () => {
    setActiveWorkflow(null);
  };

  if (!isClient || !isAuth || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading workflows...</p>
        </div>
      </div>
    );
  }

  if (activeWorkflow) {
    return (
      <WorkspaceView
        workspaceId={activeWorkflow.id}
        workspaceName={activeWorkflow.name}
        onBack={handleBackToDashboard}
      />
    );
  }

  const userName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <>
      <div className="flex h-screen bg-[#F8F8F8]">
        <Sidebar onCreateWorkspace={() => setIsCreateModalOpen(true)} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="max-w-[1400px] w-full mx-auto px-8 py-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-blue-600 mb-1">Hey, {userName}</h1>
                <p className="text-gray-500">Manage and open your workflows</p>
              </div>

              <DashboardStats workspaceCount={workflows.length} />

              {workflows.length > 0 ? (
                <ProjectGrid
                  projects={workflows.map((w) => ({
                    id: w.id,
                    title: w.name,
                    date: new Date(w.createdAt).toLocaleDateString('en-US', {
                      month: '2-digit',
                      day: '2-digit',
                      year: 'numeric',
                    }),
                  }))}
                  onOpen={handleOpenWorkflow}
                  onViewDetails={(id) => {
                    const wf = workflows.find((w) => w.id === id);
                    if (wf) handleViewDetails(id); // or show details modal
                  }}
                  onEdit={(id) => {
                    const wf = workflows.find((w) => w.id === id);
                    if (wf) setSelectedWorkflow(wf);
                    setIsEditModalOpen(true);
                  }}
                  onDelete={(id) => {
                    const wf = workflows.find((w) => w.id === id);
                    if (wf) handleDeleteClick(wf);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No workflows yet</h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Get started by creating your first workflow
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      Create Workflow
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateWorkflow}
      />

      <ViewWorkflowModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedWorkflow(null);
        }}
        workflow={selectedWorkflow}
      />

      <EditWorkspaceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedWorkflow(null);
        }}
        onSubmit={handleUpdateWorkflow}
        workflow={selectedWorkflow}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedWorkflow(null);
        }}
        onConfirm={handleDeleteConfirm}
        workspaceName={selectedWorkflow?.name || ''}
        title="Delete Workspace"
        message="This will permanently delete the workspace and all its files."
      />
    </>
  );
}