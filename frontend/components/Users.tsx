'use client';

import { useState, useEffect } from 'react';
import { Plus, Users as UsersIcon, Edit, Trash2, Mail, Shield, Calendar, UserCheck, UserX, Lock, Power, ShieldOff, X, AlertTriangle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';
import UserModal from './UserModal';
import PasswordChangeModal from './PasswordChangeModal';
import UserStatusModal from './UserStatusModal';
import { User, Role } from '@/types';
import { Status } from '@/components/ui';

// Extended User type for this component
interface UserWithDates extends User {
  id: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export default function Users() {
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<UserWithDates[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDates | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserWithDates | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUser, setStatusUser] = useState<UserWithDates | null>(null);
  const [showMfaResetModal, setShowMfaResetModal] = useState(false);
  const [mfaResetUser, setMfaResetUser] = useState<UserWithDates | null>(null);
  const [resettingMFA, setResettingMFA] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<UserWithDates[]>(API_ENDPOINTS.USERS.BASE);
      setUsers(data);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setShowModal(true);
  };

      const handleEdit = async (user: UserWithDates) => {
        try {
          // Load full user details
          const fullUser = await apiClient.get<UserWithDates>(API_ENDPOINTS.USERS.BY_ID(user.id));
      setEditingUser(fullUser);
      setShowModal(true);
    } catch (error: any) {
      console.error('Failed to load user details:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(MESSAGES.WARNING.CONFIRM_DELETE_USER)) {
      return;
    }
    try {
      await apiClient.delete(API_ENDPOINTS.USERS.BY_ID(id));
      notificationService.success(MESSAGES.SUCCESS.USER_DELETED);
      loadUsers();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.DELETE_FAILED);
    }
  };

  const handleModalSave = () => {
    loadUsers();
    setShowModal(false);
    setEditingUser(null);
  };

  const handlePasswordChange = (user: UserWithDates) => {
    setPasswordUser(user);
    setShowPasswordModal(true);
  };

  const handlePasswordModalSave = () => {
    loadUsers();
    setShowPasswordModal(false);
    setPasswordUser(null);
  };

  const handleStatusToggle = (user: UserWithDates) => {
    setStatusUser(user);
    setShowStatusModal(true);
  };

  const handleStatusModalSave = () => {
    loadUsers();
    setShowStatusModal(false);
    setStatusUser(null);
  };

  const handleResetMFA = (user: UserWithDates) => {
    setMfaResetUser(user);
    setShowMfaResetModal(true);
  };

  const handleMfaResetConfirm = async () => {
    if (!mfaResetUser) return;

    try {
      setResettingMFA(true);
      await apiClient.post(API_ENDPOINTS.MFA.RESET, { targetUserId: mfaResetUser.id });
      notificationService.success('MFA reset successfully. The user will need to set up MFA again.');
      loadUsers();
      setShowMfaResetModal(false);
      setMfaResetUser(null);
    } catch (error: any) {
      notificationService.error(error.response?.data?.error?.message || 'Failed to reset MFA');
    } finally {
      setResettingMFA(false);
    }
  };

  const handleMfaResetCancel = () => {
    setShowMfaResetModal(false);
    setMfaResetUser(null);
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
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-base text-gray-600">{MESSAGES.INFO.LOADING}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex justify-end items-center">
        {hasPermission(PERMISSION_RESOURCES.USER, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_USER) && (
          <button
            onClick={handleCreate}
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Create User</span>
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <UsersIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No users yet</h3>
          <p className="text-sm text-gray-500 mb-6">Get started by creating your first user.</p>
          {hasPermission(PERMISSION_RESOURCES.USER, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_USER) && (
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200"
            >
              Create User
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-medium text-gray-900 text-sm">
                      {user.firstName} {user.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 hidden md:table-cell">
                    {user.role ? (
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        <Shield className="h-3 w-3" />
                        <span>{user.role.name}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">No role</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <Status status={user.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-6 py-5 hidden lg:table-cell">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{formatDate(user.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end space-x-2">
                      {hasPermission(PERMISSION_RESOURCES.USER, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_USER) && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {/* Password change - only show for non-SSO users */}
                      {hasPermission(PERMISSION_RESOURCES.USER, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_CHANGE_PASSWORD) && user.source !== 'sso' && (
                        <button
                          onClick={() => handlePasswordChange(user)}
                          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-200"
                          title="Change password"
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                      )}
                      {/* MFA reset - only show for non-SSO users */}
                      {hasPermission(PERMISSION_RESOURCES.USER, PERMISSION_ACTIONS.MFA_RESET, ELEMENT_IDS.BTN_RESET_MFA) && user.source !== 'sso' && (
                        <button
                          onClick={() => handleResetMFA(user)}
                          className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-all duration-200"
                          title="Reset MFA"
                        >
                          <ShieldOff className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission(PERMISSION_RESOURCES.USER, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_TOGGLE_USER_STATUS) && (
                        <button
                          onClick={() => handleStatusToggle(user)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                            user.isActive
                              ? 'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100'
                              : 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                          }`}
                          title={user.isActive ? 'Deactivate user' : 'Activate user'}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission(PERMISSION_RESOURCES.USER, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_USER) && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200"
                          title="Delete user"
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
        <UserModal
          user={editingUser}
          onClose={() => {
            setShowModal(false);
            setEditingUser(null);
          }}
          onSave={handleModalSave}
        />
      )}

      {showPasswordModal && passwordUser && (
        <PasswordChangeModal
          user={passwordUser}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordUser(null);
          }}
          onSave={handlePasswordModalSave}
        />
      )}

      {showStatusModal && statusUser && (
        <UserStatusModal
          user={statusUser}
          onClose={() => {
            setShowStatusModal(false);
            setStatusUser(null);
          }}
          onSave={handleStatusModalSave}
        />
      )}

      {showMfaResetModal && mfaResetUser && (
        <div className="modal-overlay" onClick={handleMfaResetCancel}>
          <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100">
                  <ShieldOff className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Reset MFA
                </h2>
              </div>
              <button
                onClick={handleMfaResetCancel}
                className="btn-icon"
                disabled={resettingMFA}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800 font-medium mb-2">
                  Reset MFA for {mfaResetUser.firstName} {mfaResetUser.lastName}
                </p>
                <p className="text-sm text-purple-700">
                  This will disable MFA for this user and clear their MFA settings. They will need to set up MFA again.
                  <span className="block mt-2 font-medium">
                    Note: If MFA is enforced for your organization, the user will be required to set up MFA again on their next login.
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={handleMfaResetCancel}
                disabled={resettingMFA}
                className="btn-secondary flex-1 sm:flex-none px-6 py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleMfaResetConfirm}
                disabled={resettingMFA}
                className="btn-primary flex-1 sm:flex-none px-6 py-2.5 flex items-center justify-center space-x-2"
              >
                {resettingMFA ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4" />
                    <span>Reset MFA</span>
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
