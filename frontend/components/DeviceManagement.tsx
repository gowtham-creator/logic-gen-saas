'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { Trash2, Edit2, Monitor, Smartphone, Tablet, Check, X } from 'lucide-react';

export interface UserDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress?: string;
  lastSeenAt: string;
  createdAt: string;
  isActive: boolean;
  clientDeviceId?: string; // Client-side device ID for matching current device
}

export default function DeviceManagement() {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
    // Get current device ID from localStorage (this is the clientDeviceId)
    if (typeof window !== 'undefined') {
      const deviceId = localStorage.getItem('deviceId');
      setCurrentDeviceId(deviceId);
    }
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      // apiClient.get already unwraps the response, so it returns UserDevice[] directly
      const devices = await apiClient.get<UserDevice[]>('/api/devices');
      console.log('devices', devices);
      setDevices(devices || []);
    } catch (error: any) {
      notificationService.error('Failed to load devices');
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    // Check if this is the current device
    const isCurrentDevice = currentDeviceId && devices.find(d => d.id === deviceId)?.clientDeviceId === currentDeviceId;
    
    let confirmMessage = 'Are you sure you want to revoke access for this device?';
    if (isCurrentDevice) {
      confirmMessage += ' This will log you out from this device.';
    } else {
      confirmMessage += ' The user will be logged out from that device on their next request.';
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setRevokingId(deviceId);
      await apiClient.delete(`/api/devices/${deviceId}/revoke`);
      
      if (isCurrentDevice) {
        notificationService.success('Device access revoked successfully. You will be logged out from this device shortly.');
      } else {
        notificationService.success('Device access revoked successfully. The user will be logged out from that device on their next request.');
      }
      
      // Wait a moment for the blacklist to take effect, then check if we're still authenticated
      setTimeout(async () => {
        try {
          // Try to make a request to see if our token is still valid
          await apiClient.get('/api/auth/me');
          // If we get here, token is still valid (shouldn't happen, but just in case)
        } catch (error: any) {
          // If we get TOKEN_REVOKED, the apiClient will handle logout automatically
          // But we can also manually logout here as a fallback
          if (error.response?.data?.error?.code === 'TOKEN_REVOKED' || 
              error.response?.data?.error?.message?.includes('revoked')) {
            // Clear auth data and redirect
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
              localStorage.removeItem('isSuperAdmin');
              localStorage.removeItem('isDeveloper');
              window.location.href = '/login?message=' + encodeURIComponent('Your session has been revoked. Please log in again.');
            }
          }
        }
      }, 1000);
      
      await loadDevices();
    } catch (error: any) {
      const errorCode = error.response?.data?.error?.code;
      const errorMessage = error.response?.data?.error?.message || 'Failed to revoke device';
      
      // If we get TOKEN_REVOKED, it means we were logged out (which is expected)
      if (errorCode === 'TOKEN_REVOKED' || errorMessage.includes('revoked')) {
        notificationService.info('Device revoked. You have been logged out from this device.');
        // The apiClient should handle the logout, but we'll do it here too as fallback
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('isSuperAdmin');
          localStorage.removeItem('isDeveloper');
          window.location.href = '/login?message=' + encodeURIComponent('Your session has been revoked. Please log in again.');
        }
      } else {
        notificationService.error(errorMessage);
      }
    } finally {
      setRevokingId(null);
    }
  };

  const handleRename = async (deviceId: string) => {
    if (!editName.trim()) {
      notificationService.error('Device name cannot be empty');
      return;
    }

    try {
      await apiClient.post(`/api/devices/${deviceId}/rename`, { deviceName: editName.trim() });
      notificationService.success('Device renamed successfully');
      setEditingId(null);
      setEditName('');
      await loadDevices();
    } catch (error: any) {
      notificationService.error(error.response?.data?.error?.message || 'Failed to rename device');
    }
  };

  const startEdit = (device: UserDevice) => {
    setEditingId(device.id);
    setEditName(device.deviceName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Active Devices</h2>
        <p className="text-sm text-gray-600 mb-6">
          Manage devices that have access to your account. Revoke access for any device you don't recognize.
        </p>

        {devices.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No devices found</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1 text-gray-600">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === device.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-3 py-1 border rounded-md text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRename(device.id);
                              } else if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                          />
                          <button
                            onClick={() => handleRename(device.id)}
                            className="p-1 text-green-600 hover:text-green-700"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-gray-600 hover:text-gray-700"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">{device.deviceName}</h3>
                            {currentDeviceId && device.clientDeviceId === currentDeviceId && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                Current Device
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-gray-600 space-y-1">
                            <p>
                              {device.browser} on {device.os} • {device.deviceType}
                            </p>
                            {device.ipAddress && (
                              <p className="text-xs text-gray-500">IP: {device.ipAddress}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              Last seen: {formatDate(device.lastSeenAt)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId !== device.id && (
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => startEdit(device)}
                        className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                        title="Rename device"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevoke(device.id)}
                        disabled={revokingId === device.id}
                        className="p-2 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Revoke device"
                      >
                        {revokingId === device.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

