'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useClientAdminRoutes, useSuperAdminRoutes } from '@/hooks/useRoutes';
import RouteRenderer from '@/components/RouteRenderer';
import PermissionDenied from '@/components/PermissionDenied';
import { Shield, Plus, Edit, Trash2, Calendar, CheckCircle, XCircle, FileText } from 'lucide-react';
import RoleModal from '@/components/RoleModal';
import RoleTemplateModal from '@/components/RoleTemplateModal';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';
import { MESSAGES } from '@/constants/messages';
import { Role } from '@/types';
import { API_ENDPOINTS } from '@/constants/routes';
import AdminLayout from '@/components/layouts/AdminLayout';

function SectionContent() {
  const params = useParams();
  const section = params?.section as string;
  const routes = useClientAdminRoutes();
  const superAdminRoutes = useSuperAdminRoutes();
  const { hasPermission } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  // Find route in both client admin and super admin routes
  const currentRoute = routes.find((r) => r.tabId === section || r.path === `/${section}`) ||
                      superAdminRoutes.find((r) => r.tabId === section || r.path === `/${section}`);

  useEffect(() => {
    if (section === 'roles' || section === 'templates') {
      loadRoles();
      loadTemplates();
    }
  }, [section]);

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

  const loadTemplates = async () => {
    try {
      const data = await apiClient.get<any[]>(API_ENDPOINTS.ROLE_TEMPLATES.BASE);
      setTemplates(data);
    } catch (error: any) {
      console.error('Failed to load role templates:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
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

  if (!currentRoute) {
    return (
      <AdminLayout>
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#4B4CB2' }}>Permission Denied</h1>
          </div>
          <PermissionDenied resource={section} />
        </div>
      </AdminLayout>
    );
  }

  // Handle roles section
  if (section === 'roles') {
    if (loading) {
      return (
        <AdminLayout>
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-base text-gray-600">{MESSAGES.INFO.LOADING}</p>
          </div>
        </AdminLayout>
      );
    }

    return (
      <AdminLayout>
        <div>
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#4B4CB2' }}>Roles & Permissions</h1>
              <p className="text-sm text-gray-500">Manage user roles and their permissions</p>
            </div>
            {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_ROLE) && (
              <button
                onClick={handleCreateRole}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>Create Role</span>
              </button>
            )}
          </div>

          {roles.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No roles yet</h3>
              <p className="text-sm text-gray-500 mb-6">Get started by creating your first role.</p>
              {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_ROLE) && (
                <button
                  onClick={handleCreateRole}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200"
                >
                  Create Role
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
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">Permissions</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">Created</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {roles.map((role) => (
                      <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="font-medium text-gray-900 text-sm">{role.name}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-gray-600 text-sm">{role.description || '-'}</div>
                        </td>
                        <td className="px-6 py-5 hidden md:table-cell">
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Shield className="h-3 w-3" />
                            <span>{role.permissionIds?.length || 0} permissions</span>
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          {role.isActive !== false ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5 hidden lg:table-cell">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{formatDate((role as any).createdAt)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end space-x-2">
                            {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_ROLE) && role.id && (
                              <button
                                onClick={() => handleEditRole(role)}
                                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                                title="Edit role"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {hasPermission(PERMISSION_RESOURCES.ROLE, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_ROLE) && role.id && (
                              <button
                                onClick={() => role.id && handleDeleteRole(role.id)}
                                className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200"
                                title="Delete role"
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
      </AdminLayout>
    );
  }

  // Handle templates section
  if (section === 'templates') {
    return (
      <AdminLayout>
        <div>
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#4B4CB2' }}>Role Templates</h1>
              <p className="text-sm text-gray-500">Pre-configured role templates for quick setup</p>
            </div>
            {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_TEMPLATE) && (
              <button
                onClick={handleCreateTemplate}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>Create Template</span>
              </button>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No templates yet</h3>
              <p className="text-sm text-gray-500 mb-6">Get started by creating your first template.</p>
              {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_TEMPLATE) && (
                <button
                  onClick={handleCreateTemplate}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200"
                >
                  Create Template
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
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">Permissions</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">Created</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {templates.map((template) => (
                      <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="font-medium text-gray-900 text-sm">{template.name}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-gray-600 text-sm">{template.description || '-'}</div>
                        </td>
                        <td className="px-6 py-5 hidden md:table-cell">
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Shield className="h-3 w-3" />
                            <span>{template.permissions?.length || template.permissionIds?.length || 0} permissions</span>
                          </span>
                        </td>
                        <td className="px-6 py-5 hidden lg:table-cell">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{formatDate(template.createdAt)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end space-x-2">
                            {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_TEMPLATE) && (
                              <button
                                onClick={() => handleEditTemplate(template)}
                                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                                title="Edit template"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {hasPermission(PERMISSION_RESOURCES.ROLE_TEMPLATE, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_TEMPLATE) && (
                              <button
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200"
                                title="Delete template"
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
      </AdminLayout>
    );
  }

  // For other sections, use RouteRenderer
  return (
    <AdminLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#4B4CB2' }}>{currentRoute.label}</h1>
          {'description' in currentRoute && (currentRoute as any).description && (
            <p className="text-sm text-gray-500">{(currentRoute as any).description}</p>
          )}
        </div>
        <Suspense fallback={<div>Loading...</div>}>
          <RouteRenderer route={currentRoute} />
        </Suspense>
      </div>
    </AdminLayout>
  );
}

export default function SectionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SectionContent />
    </Suspense>
  );
}

