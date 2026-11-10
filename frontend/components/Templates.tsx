'use client';

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';
import { MESSAGES } from '@/constants/messages';
import { API_ENDPOINTS } from '@/constants/routes';
import RoleTemplateModal from './RoleTemplateModal';

export default function Templates() {
  const { hasPermission } = usePermissions();
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await apiClient.get<any[]>(API_ENDPOINTS.ROLE_TEMPLATES.BASE);
      setTemplates(data);
    } catch (error: any) {
      console.error('Failed to load role templates:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm(MESSAGES.WARNING.CONFIRM_DELETE_TEMPLATE)) {
      return;
    }
    try {
      await apiClient.delete(API_ENDPOINTS.ROLE_TEMPLATES.BY_ID(id));
      notificationService.success(MESSAGES.SUCCESS.TEMPLATE_DELETED);
      loadTemplates();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.DELETE_FAILED);
    }
  };

  const handleTemplateModalSave = () => {
    loadTemplates();
    setShowTemplateModal(false);
    setEditingTemplate(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="p-1.5 sm:p-2 bg-secondary-100 rounded-lg">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Role Templates</h2>
        </div>
        {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_TEMPLATE) && (
          <button
            onClick={handleCreateTemplate}
            className="btn-primary flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start"
          >
            <span>Create Template</span>
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Shield className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-2">{MESSAGES.INFO.NO_DATA}</p>
              {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_TEMPLATE) && (
                <button
                  onClick={handleCreateTemplate}
                  className="btn-primary mt-4 flex items-center space-x-2 mx-auto"
                >
                  <span>Create Your First Template</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="table-header">
                <tr>
                  <th className="table-cell font-semibold text-gray-900">Name</th>
                  <th className="table-cell font-semibold text-gray-900">Description</th>
                  <th className="table-cell font-semibold text-gray-900 hidden md:table-cell">Permissions</th>
                  <th className="table-cell font-semibold text-gray-900 hidden lg:table-cell">Created</th>
                  <th className="table-cell font-semibold text-gray-900 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">{template.name}</div>
                    </td>
                    <td className="table-cell">
                      <div className="text-gray-600 text-sm">{template.description || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <span className="badge-info flex items-center space-x-1 w-fit">
                        <Shield className="h-3 w-3" />
                        <span>{template.permissions?.length || template.permissionIds?.length || 0} permissions</span>
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">{formatDate(template.createdAt)}</span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end space-x-1 sm:space-x-2">
                        {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_TEMPLATE) && (
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        )}
                        {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_TEMPLATE) && (
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                          >
                            Delete
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

      {showTemplateModal && (
        <RoleTemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onSave={handleTemplateModalSave}
        />
      )}
    </div>
  );
}

