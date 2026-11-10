'use client';

import { useState, useEffect } from 'react';
import { Plus, FileText, Edit, Trash2, Calendar, User, Eye, Upload, Download, X, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';
import WorkflowModal from './WorkflowModal';
import WorkflowFilesModal from './WorkflowFilesModal';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  createdUserId?: string;
  updatedUserId?: string;
  createdUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  files?: WorkflowFile[];
}

interface WorkflowFile {
  id: string;
  fileName: string;
  originalFileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  createdUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function Workflows() {
  const { hasPermission } = usePermissions();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
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

  const handleCreate = () => {
    setEditingWorkflow(null);
    setShowModal(true);
  };

  const handleEdit = async (workflow: Workflow) => {
    try {
      const fullWorkflow = await apiClient.get<Workflow>(`/api/workflows/${workflow.id}`);
      setEditingWorkflow(fullWorkflow);
      setShowModal(true);
    } catch (error: any) {
      console.error('Failed to load workflow details:', error);
      notificationService.error('Failed to load workflow details');
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setWorkflowToDelete({ id, name });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!workflowToDelete) return;
    
    try {
      setDeleting(true);
      await apiClient.delete(`/api/workflows/${workflowToDelete.id}`);
      notificationService.success('Workflow deleted successfully');
      setShowDeleteModal(false);
      setWorkflowToDelete(null);
      loadWorkflows();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to delete workflow');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setWorkflowToDelete(null);
  };

  const handleViewFiles = async (workflowIds: string[]) => {
    setSelectedWorkflows(workflowIds);
    setShowFilesModal(true);
  };

  const handleModalSave = () => {
    loadWorkflows();
    setShowModal(false);
    setEditingWorkflow(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatUserName = (user?: { firstName: string; lastName: string }) => {
    if (!user) return 'N/A';
    return `${user.firstName} ${user.lastName}`;
  };

  return (
    <div>
      <div className="mb-8 flex justify-end items-center">
        {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_WORKFLOW) && (
          <button
            onClick={handleCreate}
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Create Workflow</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-base text-gray-600">Loading workflows...</p>
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No workflows yet</h3>
          <p className="text-sm text-gray-500 mb-6">Get started by creating your first workflow.</p>
          {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.CREATE) && (
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200"
            >
              Create Workflow
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created By</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Updated By</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-medium text-gray-900 text-sm">{workflow.name}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-gray-600 max-w-xs truncate">
                      {workflow.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm text-gray-700">{formatUserName(workflow.createdUser)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-sm text-gray-700">{formatUserName(workflow.updatedUser)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {workflow.isActive ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{formatDate(workflow.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end space-x-2">
                      {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.READ, ELEMENT_IDS.BTN_VIEW_WORKFLOW_FILES) && (
                        <button
                          onClick={() => handleViewFiles([workflow.id])}
                          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-200"
                          title="View files"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_WORKFLOW) && (
                        <button
                          onClick={() => handleEdit(workflow)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                          title="Edit workflow"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_WORKFLOW) && (
                        <button
                          onClick={() => handleDeleteClick(workflow.id, workflow.name)}
                          className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200"
                          title="Delete workflow"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showModal && (
        <WorkflowModal
          workflow={editingWorkflow}
          onClose={() => {
            setShowModal(false);
            setEditingWorkflow(null);
          }}
          onSave={handleModalSave}
        />
      )}

      {showFilesModal && (
        <WorkflowFilesModal
          workflowIds={selectedWorkflows}
          onClose={() => {
            setShowFilesModal(false);
            setSelectedWorkflows([]);
          }}
          onFileChange={loadWorkflows}
        />
      )}

      {showDeleteModal && workflowToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleDeleteCancel}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Delete Workflow
                </h2>
              </div>
              <button
                onClick={handleDeleteCancel}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                disabled={deleting}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-800 font-medium mb-2">
                  This action cannot be undone.
                </p>
                <p className="text-sm text-red-700">
                  Are you sure you want to delete <span className="font-semibold">"{workflowToDelete.name}"</span>? This will also delete all associated files.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

