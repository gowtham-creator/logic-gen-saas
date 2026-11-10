'use client';

import { useState, useEffect } from 'react';
import { FileText, X, CheckCircle, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { RoleTemplate, Permission, RoleTemplateModalProps } from '@/types';

export default function RoleTemplateModal({ template, onClose, onSave }: RoleTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  useEffect(() => {
    loadPermissions();
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setSelectedPermissionIds(
        template.templatePermissions?.map((tp) => tp.permission?.id || '') || 
        template.permissionIds || 
        []
      );
    }
  }, [template]);

  const loadPermissions = async () => {
    try {
      setLoadingPermissions(true);
      const data = await apiClient.get<Permission[]>(API_ENDPOINTS.PERMISSIONS.BASE);
      setPermissions(data);
    } catch (error: any) {
      console.error('Failed to load permissions:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate description is not empty
    if (!description.trim()) {
      notificationService.warning(MESSAGES.WARNING.DESCRIPTION_REQUIRED);
      return;
    }
    
    setLoading(true);

    try {
      const payload = {
        name,
        description: description.trim(),
        permissionIds: selectedPermissionIds.length > 0 ? selectedPermissionIds : [],
      };
      
      if (template) {
        await apiClient.put(API_ENDPOINTS.ROLE_TEMPLATES.BY_ID(template.id), payload);
      } else {
        await apiClient.post(API_ENDPOINTS.ROLE_TEMPLATES.BASE, payload);
      }
      notificationService.success(
        template ? MESSAGES.SUCCESS.TEMPLATE_UPDATED : MESSAGES.SUCCESS.TEMPLATE_CREATED
      );
      onSave();
      onClose();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.SAVE_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    const key = perm.resource;
    if (!acc[key]) acc[key] = [];
    acc[key].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {template ? 'Edit Role Template' : 'Create Role Template'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-field"
              placeholder="e.g., Admin Template"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="input-field"
              placeholder="Template description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="inline h-4 w-4 mr-1" />
              Permissions
            </label>
            {loadingPermissions ? (
              <div className="flex items-center justify-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-auto bg-gray-50">
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource} className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 capitalize flex items-center">
                      <Shield className="h-4 w-4 mr-1 text-primary-600" />
                      {resource}
                    </h4>
                    <div className="space-y-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className={`flex items-center px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                            selectedPermissionIds.includes(perm.id)
                              ? 'bg-primary-50 border-primary-300 text-primary-700'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissionIds.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-sm">
                            {perm.action}
                            {perm.elementId && <span className="text-gray-500"> ({perm.elementId})</span>}
                            {perm.description && <span className="text-gray-500"> - {perm.description}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {template ? 'Update Template' : 'Create Template'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

