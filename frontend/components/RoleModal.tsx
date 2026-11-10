'use client';

import { useState, useEffect } from 'react';
import { Shield, X, CheckCircle, FileText, Users, Info } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { Role, Permission, RoleTemplate, RoleModalProps } from '@/types';

export default function RoleModal({ role, roles, onClose, onSave }: RoleModalProps) {
  const [formData, setFormData] = useState<Role>({
    name: '',
    description: '',
    templateId: undefined,
    permissionIds: [],
    isActive: true,
  });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || '',
        description: role.description || '',
        parentRoleId: role.parentRoleId,
        templateId: role.templateId,
        permissionIds: role.permissionIds || [],
        isActive: role.isActive !== undefined ? role.isActive : true,
      });
    }
    loadPermissions();
    loadTemplates();
  }, [role]);

  const loadPermissions = async () => {
    try {
      const data = await apiClient.get<Permission[]>(API_ENDPOINTS.PERMISSIONS.BASE);
      setPermissions(data);
    } catch (err: any) {
      console.error('Failed to load permissions:', err);
      setError('Failed to load permissions');
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await apiClient.get<RoleTemplate[]>(API_ENDPOINTS.ROLE_TEMPLATES.BASE);
      setTemplates(data);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Prepare payload - explicitly set null for empty values to clear them
      const payload: any = {
        name: formData.name,
        permissionIds: formData.permissionIds || [],
        isActive: formData.isActive !== undefined ? formData.isActive : true,
      };

      // Only include optional fields if they have values, or explicitly set to null to clear
      if (formData.description !== undefined && formData.description !== '') {
        payload.description = formData.description;
      }
      
      // Always send parentRoleId and templateId - null if not set, to explicitly clear them
      payload.parentRoleId = formData.parentRoleId || null;
      payload.templateId = formData.templateId || null;

      if (role?.id) {
        // Update existing role
        await apiClient.put(API_ENDPOINTS.ROLES.BY_ID(role.id), payload);
      } else {
        // Create new role
        await apiClient.post(API_ENDPOINTS.ROLES.BASE, payload);
      }
      notificationService.success(
        role?.id ? MESSAGES.SUCCESS.ROLE_UPDATED : MESSAGES.SUCCESS.ROLE_CREATED
      );
      onSave();
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || MESSAGES.ERROR.SAVE_FAILED;
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds?.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...(prev.permissionIds || []), permissionId],
    }));
  };

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {role?.id ? 'Edit Role' : 'Create Role'}
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

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="input-field"
              placeholder="e.g., Admin, Manager"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="input-field"
              placeholder="Role description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline h-4 w-4 mr-1" />
              Role Template (Optional)
            </label>
            <select
              value={formData.templateId || ''}
              onChange={(e) => {
                const templateId = e.target.value === '' ? undefined : e.target.value;
                setFormData({ ...formData, templateId, permissionIds: [] }); // Clear permissions when template changes
              }}
              className="input-field"
            >
              <option value="">No Template (Manual Permissions)</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.description && `- ${template.description}`}
                </option>
              ))}
            </select>
            {formData.templateId && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <Info className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    When a template is selected, permissions are automatically synced from the template. 
                    Changes to the template will automatically update this role.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Parent Role (optional)
            </label>
            <select
              value={formData.parentRoleId || ''}
              onChange={(e) => {
                const parentRoleId = e.target.value === '' ? undefined : e.target.value;
                setFormData({ ...formData, parentRoleId });
              }}
              className="input-field"
            >
              <option value="">None</option>
              {roles
                .filter((r) => r.id && r.id !== role?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="inline h-4 w-4 mr-1" />
              Permissions {formData.templateId && '(Managed by Template)'}
            </label>
            {formData.templateId ? (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-start">
                  <Info className="h-4 w-4 text-gray-600 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700">
                    Permissions are managed by the selected template. Edit the template to change permissions for all roles using it.
                  </p>
                </div>
              </div>
            ) : (
            <div className="border border-gray-200 rounded-lg p-4 max-h-80 overflow-auto bg-gray-50">
              {Object.entries(groupedPermissions).map(([resource, perms]) => (
                <div key={resource} className="mb-6 last:mb-0">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 capitalize flex items-center">
                    <Shield className="h-4 w-4 mr-1 text-primary-600" />
                    {resource}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className={`flex items-center px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                          formData.permissionIds?.includes(perm.id)
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissionIds?.includes(perm.id) || false}
                          onChange={() => togglePermission(perm.id)}
                          className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="text-sm">
                          {perm.action} {perm.description && `- ${perm.description}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive !== false}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`btn-primary ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? (
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
                  {role?.id ? 'Update Role' : 'Create Role'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

