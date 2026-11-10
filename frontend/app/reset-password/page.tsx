'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { forceResetPassword, getStoredUser, logout } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { MESSAGES } from '@/constants/messages';
import { TempUser } from '@/types';
import PasswordInput from '@/components/PasswordInput';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<TempUser | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tempUserStr = localStorage.getItem('tempUser');
    if (tempUserStr) {
      try {
        const tempUser = JSON.parse(tempUserStr);
        setUser(tempUser);
      } catch {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      setLoading(false);
      return;
    }

    try {
      if (!user?.email) {
        setError('User email is required');
        setLoading(false);
        return;
      }
      
      await forceResetPassword(user.email, currentPassword, newPassword);
      notificationService.success(MESSAGES.SUCCESS.PASSWORD_RESET);
      localStorage.removeItem('tempUser');
      await logout(); // Clear any existing tokens
      router.push('/login');
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || MESSAGES.ERROR.SAVE_FAILED);
      notificationService.error(error.message || MESSAGES.ERROR.SAVE_FAILED);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Your Password</h1>
            <p className="text-gray-600">
              Hello, {user.firstName}! You are required to reset your password before proceeding.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password (min 8 characters)
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Enter your new password"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm your new password"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
