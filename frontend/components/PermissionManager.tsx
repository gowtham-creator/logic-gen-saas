'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { Permission } from '@/types';
import { Loader2, Shield, Edit2, Code, Info, X } from 'lucide-react';

export default function PermissionManager() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [editFormData, setEditFormData] = useState({ elementId: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Permission[]>(API_ENDPOINTS.PERMISSIONS.BASE);
      setPermissions(data);
    } catch (error: any) {
      console.error('Failed to load permissions:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (permission: Permission) => {
    setEditingPermission(permission);
    setEditFormData({
      elementId: permission.elementId || '',
      description: permission.description || '',
    });
  };

  const handleCancel = () => {
    setEditingPermission(null);
    setEditFormData({ elementId: '', description: '' });
  };

  const handleSave = async () => {
    if (!editingPermission) return;

    try {
      setSaving(true);
      await apiClient.put(API_ENDPOINTS.PERMISSIONS.BY_ID(editingPermission.id), {
        elementId: editFormData.elementId.trim() || null,
        description: editFormData.description.trim() || undefined,
      });
      notificationService.success(MESSAGES.SUCCESS.PERMISSION_UPDATED);
      await loadPermissions();
      handleCancel();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#4B4CB2' }}>Permissions & UI Elements</h1>
        <p className="text-sm text-gray-500">
          Attach UI element IDs to permissions for element-level access control.
          Use these IDs in your React components with the <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">usePermissions</code> hook.
        </p>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {Object.entries(groupedPermissions).map(([resource, perms]) => (
          <div key={resource} className="border-b border-gray-100 last:border-b-0">
            {/* Resource Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 capitalize flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                {resource.replace('-', ' ')}
              </h3>
            </div>

            {/* Permissions Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/5">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-2/5">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/3">
                      UI Element ID
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/12">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {perms.map((perm) => (
                    <tr key={perm.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                          {perm.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {perm.description || <span className="text-gray-400 italic">-</span>}
                      </td>
                      <td className="px-6 py-4">
                        <code className={`px-2.5 py-1 rounded-lg text-xs font-mono ${
                          perm.elementId
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-50 text-gray-500'
                        }`}>
                          {perm.elementId || 'Not set'}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEdit(perm)}
                          className="p-2 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                          title="Edit Permission"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Usage Example Card */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-2">Usage Example</h4>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <pre className="text-xs font-mono text-gray-800 overflow-x-auto">
{`const { hasPermission } = usePermissions();
{hasPermission('role', 'create', 'btn-create-role') && (
  <button>Create Role</button>
)}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Permission Modal */}
      {editingPermission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={handleCancel}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Edit Permission</h3>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Resource & Action Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs text-gray-600 mb-1 font-medium">Resource</div>
                <div className="font-semibold text-gray-900 capitalize">
                  {editingPermission.resource.replace('-', ' ')}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs text-gray-600 mb-1 font-medium">Action</div>
                <div className="font-semibold text-gray-900">{editingPermission.action}</div>
              </div>
            </div>

            {/* UI Element ID Input */}
            <div className="mb-6">
              <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                <Code className="w-4 h-4 text-gray-600" />
                UI Element ID
              </label>
              <input
                type="text"
                value={editFormData.elementId}
                onChange={(e) => setEditFormData({ ...editFormData, elementId: e.target.value })}
                placeholder="e.g., btn-create-role, table-users, sidebar-roles"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
              />
              <p className="text-xs text-gray-500 mt-2">
                Leave empty to remove element ID
              </p>
            </div>

            {/* Description Input */}
            <div className="mb-8">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Describe what this permission allows"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-vertical"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
