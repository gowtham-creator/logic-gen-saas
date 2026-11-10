'use client';

import { useState, useEffect } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { User } from '@/types';
import PasswordInput from '@/components/PasswordInput';

interface PasswordChangeModalProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

export default function PasswordChangeModal({ user, onClose, onSave }: PasswordChangeModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Prevent password changes for SSO users
  const isSSOUser = user?.source === 'sso';
  
  useEffect(() => {
    if (isSSOUser) {
      setError('Password changes are not allowed for SSO users. Password is managed by the SSO provider.');
    }
  }, [isSSOUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password || !password.trim()) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Prevent submission for SSO users
    if (isSSOUser) {
      setError('Password changes are not allowed for SSO users. Password is managed by the SSO provider.');
      return;
    }

    setSaving(true);

    try {
      await apiClient.put(API_ENDPOINTS.USERS.BY_ID(user.id!), {
        password,
      });
      notificationService.success('Password updated successfully');
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
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary-100">
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Change Password
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

        {isSSOUser ? (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>
                <strong>{user.firstName} {user.lastName}</strong> ({user.email}) is an SSO user.
              </span>
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Password changes are not allowed for SSO users. Password is managed by the SSO provider.
            </p>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Changing password for <strong>{user.firstName} {user.lastName}</strong> ({user.email})
            </p>
            <p className="text-xs text-blue-700 mt-1">
              The user will be required to reset their password on next login.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {isSSOUser ? (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600 text-center">
                Password management is not available for SSO users.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <Lock className="h-4 w-4 text-gray-500" />
                  <span>New Password <span className="text-red-500">*</span></span>
                </label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <Lock className="h-4 w-4 text-gray-500" />
                  <span>Confirm Password <span className="text-red-500">*</span></span>
                </label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm new password"
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

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
              disabled={saving || isSSOUser}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{MESSAGES.INFO.SAVING}</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

