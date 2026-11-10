'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { resetPassword } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import PasswordInput from '@/components/PasswordInput';

interface ResetPasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ResetPasswordModal({ onClose, onSuccess }: ResetPasswordModalProps): ReactNode {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Only render portal on client side
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!currentPassword || !currentPassword.trim()) {
      setError('Current password is required');
      return;
    }

    if (!newPassword || !newPassword.trim()) {
      setError('New password is required');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Password complexity check
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordPattern.test(newPassword)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setSaving(true);

    try {
      await resetPassword(currentPassword, newPassword);
      notificationService.success('Password reset successfully');
      onSuccess?.();
      onClose();
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to reset password';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary-100">
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Reset Password
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

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Enter your current password and choose a new password.
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <span>Current Password <span className="text-red-500">*</span></span>
            </label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <span>New Password <span className="text-red-500">*</span></span>
            </label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Enter new password"
              minLength={8}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 8 characters with uppercase, lowercase, number, and special character
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <span>Confirm New Password <span className="text-red-500">*</span></span>
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
                  <span>Resetting...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Reset Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render modal in a portal at document body level to avoid z-index issues
  if (!mounted) return null;
  
  return createPortal(modalContent, document.body);
}

