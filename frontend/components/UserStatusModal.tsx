'use client';

import { useState } from 'react';
import { X, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { User } from '@/types';

interface UserStatusModalProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

export default function UserStatusModal({ user, onClose, onSave }: UserStatusModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const newStatus = !user.isActive; // Toggle status
  const isDeactivating = user.isActive && !newStatus;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Require confirmation when deactivating
    if (isDeactivating && !confirmed) {
      setError('Please confirm that you want to deactivate this user');
      return;
    }

    setSaving(true);

    try {
      await apiClient.put(API_ENDPOINTS.USERS.BY_ID(user.id!), {
        isActive: newStatus,
      });
      notificationService.success(
        newStatus 
          ? 'User activated successfully' 
          : 'User deactivated successfully'
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className={`p-1.5 sm:p-2 rounded-lg ${newStatus ? 'bg-green-100' : 'bg-red-100'}`}>
              {newStatus ? (
                <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              ) : (
                <UserX className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {newStatus ? 'Activate User' : 'Deactivate User'}
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
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-4">
            {isDeactivating ? (
              <>
                You are about to <strong className="text-red-600">deactivate</strong> the following user:
              </>
            ) : (
              <>
                You are about to <strong className="text-green-600">activate</strong> the following user:
              </>
            )}
          </p>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-600 mt-1">{user.email}</p>
            <p className="text-xs text-gray-500 mt-2">
              Current status: <span className={user.isActive ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
        </div>

        {isDeactivating && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  Warning: Deactivating User
                </p>
                <p className="text-xs text-yellow-700">
                  Deactivated users will not be able to log in to the system. This action can be reversed by activating the user again.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {isDeactivating && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700 block">
                    I confirm that I want to deactivate this user
                  </span>
                  <p className="mt-1 text-xs text-gray-600">
                    Please check this box to proceed with deactivation
                  </p>
                </div>
              </label>
            </div>
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
              disabled={saving || (isDeactivating && !confirmed)}
              className={`flex items-center space-x-2 ${
                newStatus 
                  ? 'btn-primary' 
                  : 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{MESSAGES.INFO.SAVING}</span>
                </>
              ) : (
                <>
                  {newStatus ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      <span>Activate User</span>
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4" />
                      <span>Deactivate User</span>
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

