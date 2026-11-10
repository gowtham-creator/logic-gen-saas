'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Shield, Save, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getStoredUser, logout } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import type { User as UserType, Role } from '@/types';
import Header from '@/components/Header';
import DeviceManagement from '@/components/DeviceManagement';

export default function ProfilePage() {
  const router = useRouter();
  const storedUser = getStoredUser();
  const [user, setUser] = useState<UserType | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const loadingRef = useRef(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  useEffect(() => {
    if (!storedUser) {
      router.push('/login');
      return;
    }
    
    // Prevent multiple simultaneous calls
    if (loadingRef.current) return;
    
    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedUser?.id]); // Only depend on the ID, not the whole object

  const loadUserProfile = async () => {
    if (!storedUser?.id || loadingRef.current) return;
    
    loadingRef.current = true;

    try {
      setLoading(true);
      const userData = await apiClient.get<UserType>(`${API_ENDPOINTS.USERS.BASE}/${storedUser.id}`);
      setUser(userData);
      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
      });

      // Load role if available
      if (userData.roleId) {
        try {
          const roleData = await apiClient.get<Role>(`${API_ENDPOINTS.ROLES.BASE}/${userData.roleId}`);
          setRole(roleData);
        } catch (error) {
          console.error('Failed to load role:', error);
        }
      }
    } catch (error: any) {
      console.error('Failed to load user profile:', error);
      if (error.response?.status === 401) {
        await logout();
        router.push('/login');
      } else {
        setError('Failed to load profile');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await apiClient.put(`${API_ENDPOINTS.USERS.BASE}/${user.id}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      // Update stored user
      const updatedUser = { ...storedUser, firstName: formData.firstName, lastName: formData.lastName };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setSuccess('Profile updated successfully');
      notificationService.success('Profile updated successfully');
      
      // Reload user data
      await loadUserProfile();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to update profile';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4 mx-auto"></div>
          <div className="h-64 bg-gray-200 rounded w-96"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30">
      <Header
        title="Profile"
        subtitle="Manage your account information"
        icon={User}
      />

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Profile Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>Email</span>
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span>First Name</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span>Last Name</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Role (Read-only) */}
            {role && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span>Role</span>
                </label>
                <input
                  type="text"
                  value={role.name || 'No role assigned'}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Device Management Section */}
        <div className="mt-8">
          <DeviceManagement />
        </div>
      </div>
    </div>
  );
}

