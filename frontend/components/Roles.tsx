'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';
import { MESSAGES } from '@/constants/messages';
import { Role } from '@/types';
import { API_ENDPOINTS } from '@/constants/routes';
import RoleModal from './RoleModal';
import { Status } from '@/components/ui';

export default function Roles() {
  const { hasPermission } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Role[]>(API_ENDPOINTS.ROLES.BASE);
      const rolesWithPermissions = data.map((role: any) => ({
        ...role,
        permissionIds: role.rolePermissions?.map((rp: any) => rp.permission?.id || rp.permissionId) || [],
      }));
      setRoles(rolesWithPermissions);
    } catch (error: any) {
      console.error('Failed to load roles:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setShowModal(true);
  };

  const handleEditRole = async (role: Role) => {
    if (!role.id) return;
    try {
      const fullRole = await apiClient.get<any>(API_ENDPOINTS.ROLES.BY_ID(role.id));
      let permissionIds: string[] = [];
      if (fullRole.permissionIds && Array.isArray(fullRole.permissionIds)) {
        permissionIds = fullRole.permissionIds;
      } else if (fullRole.rolePermissions && Array.isArray(fullRole.rolePermissions)) {
        permissionIds = fullRole.rolePermissions.map((rp: any) => rp.permission?.id || rp.permissionId).filter(Boolean);
      }
      
      const roleWithPermissions = {
        ...fullRole,
        permissionIds,
      };
      setEditingRole(roleWithPermissions);
      setShowModal(true);
    } catch (error: any) {
      console.error('Failed to load role details:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm(MESSAGES.WARNING.CONFIRM_DELETE_ROLE)) {
      return;
    }
    try {
      await apiClient.delete(API_ENDPOINTS.ROLES.BY_ID(id));
      notificationService.success(MESSAGES.SUCCESS.ROLE_DELETED);
      loadRoles();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.DELETE_FAILED);
    }
  };

  const handleRoleModalSave = () => {
    loadRoles();
    setShowModal(false);
    setEditingRole(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-gray-600 font-medium">{MESSAGES.INFO.LOADING}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Roles & Permissions</h2>
        </div>
        {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_ROLE) && (
          <button
            onClick={handleCreateRole}
            className="btn-primary flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start"
          >
            <span>Create Role</span>
          </button>
        )}
      </div>

      {roles.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Shield className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-2">{MESSAGES.INFO.NO_DATA}</p>
              {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_ROLE) && (
                <button
                  onClick={handleCreateRole}
                  className="btn-primary mt-4 flex items-center space-x-2 mx-auto"
                >
                  <span>Create Your First Role</span>
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
                  <th className="table-cell font-semibold text-gray-900">Status</th>
                  <th className="table-cell font-semibold text-gray-900 hidden lg:table-cell">Created</th>
                  <th className="table-cell font-semibold text-gray-900 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">{role.name}</div>
                    </td>
                    <td className="table-cell">
                      <div className="text-gray-600 text-sm">{role.description || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <span className="badge-info flex items-center space-x-1 w-fit">
                        <Shield className="h-3 w-3" />
                        <span>{role.permissionIds?.length || 0} permissions</span>
                      </span>
                    </td>
                    <td className="table-cell">
                      <Status status={role.isActive !== false ? 'active' : 'inactive'} />
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">{formatDate((role as any).createdAt)}</span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end space-x-1 sm:space-x-2">
                        {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_ROLE) && role.id && (
                          <button
                            onClick={() => handleEditRole(role)}
                            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        )}
                        {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_ROLE) && role.id && (
                          <button
                            onClick={() => role.id && handleDeleteRole(role.id)}
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

      {showModal && (
        <RoleModal
          role={editingRole}
          roles={roles}
          onClose={() => {
            setShowModal(false);
            setEditingRole(null);
          }}
          onSave={handleRoleModalSave}
        />
      )}
    </div>
  );
}

