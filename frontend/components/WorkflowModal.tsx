'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface WorkflowModalProps {
  workflow: Workflow | null;
  onClose: () => void;
  onSave: () => void;
}

export default function WorkflowModal({ workflow, onClose, onSave }: WorkflowModalProps) {
  const { hasPermission } = usePermissions();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflow) {
      setFormData({
        name: workflow.name || '',
        description: workflow.description || '',
        isActive: workflow.isActive !== undefined ? workflow.isActive : true,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        isActive: true,
      });
    }
  }, [workflow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (workflow) {
        await apiClient.put(`/api/workflows/${workflow.id}`, formData);
        notificationService.success('Workflow updated successfully');
      } else {
        await apiClient.post('/api/workflows', formData);
        notificationService.success('Workflow created successfully');
      }
      onSave();
    } catch (error: any) {
      console.error('Failed to save workflow:', error);
      setError(error.message || 'Failed to save workflow');
      notificationService.error(error.message || 'Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {workflow ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="input-field"
              placeholder="e.g., Data Processing Workflow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="input-field"
              placeholder="Workflow description..."
            />
          </div>

          {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_TOGGLE_WORKFLOW_STATUS) && (
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                {workflow ? 'Enable or disable this workflow' : 'Workflow will be active by default'}
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{workflow ? 'Update' : 'Create'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

