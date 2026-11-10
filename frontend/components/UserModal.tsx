'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, User as UserIcon, Mail, Shield, AlertCircle, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { getStoredUser } from '@/lib/auth';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { User, Role, UserModalProps, UserFormData } from '@/types';
import PasswordInput from '@/components/PasswordInput';

export default function UserModal({ user, onClose, onSave }: UserModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    roleId: undefined,
    password: '',
  });
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const currentUser = getStoredUser();
  const isEditingSelf = user?.id && currentUser?.id === user.id;

  useEffect(() => {
    loadRoles();
    if (user) {
      setFormData({
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        roleId: user.roleId || undefined,
        password: '', // Don't pre-fill password for editing
      });
    } else {
      // Reset form for new user
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        roleId: undefined,
        password: '',
      });
    }
  }, [user]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Role[]>(API_ENDPOINTS.ROLES.BASE);
      setRoles(data);
    } catch (err: any) {
      console.error('Failed to load roles:', err);
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
      };

      // For new users, include email (required)
      if (!user?.id) {
        payload.email = formData.email;
        // Password is required for new users
        if (!formData.password || !formData.password.trim()) {
          setError('Password is required for new users');
          setSaving(false);
          return;
        }
        payload.password = formData.password;
      }
      // Email cannot be updated for existing users
      // Password is NOT updated here for existing users - use PasswordChangeModal instead

      // Don't allow users to update their own role (security: prevent privilege escalation)
      if (!isEditingSelf) {
        payload.roleId = formData.roleId || null;
      }

      if (user?.id) {
        // Update existing user
        await apiClient.put(API_ENDPOINTS.USERS.BY_ID(user.id), payload);
        notificationService.success(MESSAGES.SUCCESS.USER_UPDATED);
      } else {
        // Create new user
        await apiClient.post(API_ENDPOINTS.USERS.BASE, payload);
        notificationService.success(MESSAGES.SUCCESS.USER_CREATED);
      }

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className={`p-1.5 sm:p-2 rounded-lg ${user?.id ? 'bg-primary-100' : 'bg-green-100'}`}>
              {user?.id ? (
                <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
              ) : (
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {user?.id ? 'Edit User' : 'Create User'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span>Email {!user?.id && <span className="text-red-500">*</span>}</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                setEmailError(''); // Clear error on change
              }}
              onBlur={async (e) => {
                // Only check for new users (email can't be changed for existing users)
                if (user?.id) {
                  return;
                }
                
                const email = e.target.value.trim();
                if (!email) {
                  setEmailError('');
                  return;
                }
                
                // Basic email format validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                  setEmailError('Invalid email format');
                  return;
                }

                setCheckingEmail(true);
                setEmailError('');
                try {
                  const response = await apiClient.get<{ available: boolean }>('/api/users/check-email', {
                    params: { email },
                  });
                  if (!response.available) {
                    setEmailError('This email is already in use');
                  }
                } catch (err: any) {
                  // If 400 error, email is not available
                  if (err.response?.status === 400) {
                    setEmailError(err.response?.data?.message || 'This email is already in use');
                  } else {
                    // Other errors, don't show error (might be network issue)
                    console.error('Error checking email:', err);
                  }
                } finally {
                  setCheckingEmail(false);
                }
              }}
              required={!user?.id}
              disabled={!!user?.id}
              className={`input-field ${emailError ? 'border-red-500' : ''} ${user?.id ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              placeholder="user@example.com"
            />
            {checkingEmail && (
              <p className="text-xs text-gray-500 mt-1">Checking email availability...</p>
            )}
            {emailError && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <span>⚠</span> {emailError}
              </p>
            )}
            {user?.id && (
              <p className="mt-1 text-xs text-gray-500 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>Email cannot be changed for security reasons</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                className="input-field"
              />
            </div>
          </div>

          {!user?.id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <Lock className="h-4 w-4 text-gray-500" />
                <span>Password <span className="text-red-500">*</span></span>
              </label>
              <PasswordInput
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="Minimum 8 characters"
                minLength={8}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 8 characters long
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
              <Shield className="h-4 w-4 text-gray-500" />
              <span>Role</span>
            </label>
            <select
              value={formData.roleId || ''}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value || undefined })}
              disabled={!!isEditingSelf}
              className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">No role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {isEditingSelf && (
              <p className="mt-1 text-xs text-gray-500 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>You cannot change your own role for security reasons</span>
              </p>
            )}
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
              className="btn-primary flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{MESSAGES.INFO.SAVING}</span>
                </>
              ) : (
                <>
                  {user?.id ? (
                    <>
                      <UserIcon className="h-4 w-4" />
                      <span>Update User</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Create User</span>
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
