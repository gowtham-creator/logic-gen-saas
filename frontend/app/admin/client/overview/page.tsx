'use client';

import { useEffect, useState } from 'react';
import { Users, Shield, FileText, Plus, Settings, Key } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Stats {
  totalUsers: number;
  totalRoles: number;
  totalTemplates: number;
}

interface AuditLog {
  id: string;
  message: string;
  timestamp: string;
}

interface UserActivity {
  name: string;
  email: string;
  status: 'active' | 'inactive';
  lastActive: string;
  avatar?: string;
}

export default function AdminOverviewPage() {
  const user = getStoredUser();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalRoles: 0, totalTemplates: 0 });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Load stats
      const [users, roles] = await Promise.all([
        apiClient.get('/api/users'),
        apiClient.get('/api/roles'),
      ]);

      setStats({
        totalUsers: Array.isArray(users) ? users.length : 0,
        totalRoles: Array.isArray(roles) ? roles.length : 0,
        totalTemplates: 8, // Mock data
      });

      // Mock audit logs
      setAuditLogs([
        { id: '1', message: 'New user added to team', timestamp: 'Today' },
        { id: '2', message: 'Role permissions updated', timestamp: 'Yesterday' },
        { id: '3', message: 'New template created', timestamp: '2 days ago' },
        { id: '4', message: 'API key generated', timestamp: '3 days ago' },
        { id: '5', message: 'Webhook configuration changed', timestamp: '1 week ago' },
      ]);

      // Mock user activity
      setUserActivity([
        { name: 'John Doe', email: 'john@example.com', status: 'active', lastActive: 'Today' },
        { name: 'Jane Smith', email: 'jane@example.com', status: 'inactive', lastActive: '2 days ago' },
        { name: 'Mike Johnson', email: 'mike@example.com', status: 'active', lastActive: 'Today' },
        { name: 'Sarah Williams', email: 'sarah@example.com', status: 'inactive', lastActive: '5 days ago' },
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const userName = user?.firstName || user?.email?.split('@')[0] || 'Admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4B5EFC] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading overview...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#E91E8C] to-[#4B5EFC] mb-2">
          Hey, {userName}
        </h1>
        <p className="text-gray-600">Create, Manage and Regulate Logicgen seemlessly.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Users Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-2">No.of Users</p>
                <p className="text-4xl font-bold text-[#4B5EFC]">{stats.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-[#EEF0FF] rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-[#4B5EFC]" />
              </div>
            </div>
          </div>

          {/* Roles Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-2">No.of Roles</p>
                <p className="text-4xl font-bold text-[#FF8A3C]">{stats.totalRoles}</p>
              </div>
              <div className="w-12 h-12 bg-[#FFF4ED] rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#FF8A3C]" />
              </div>
            </div>
          </div>

          {/* Templates Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-2">No.of Templates</p>
                <p className="text-4xl font-bold text-[#A855F7]">{stats.totalTemplates}</p>
              </div>
              <div className="w-12 h-12 bg-[#F5EFFF] rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#A855F7]" />
              </div>
            </div>
          </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button className="px-6 py-2.5 border-2 border-[#4B5EFC] text-[#4B5EFC] rounded-lg font-medium hover:bg-[#4B5EFC] hover:text-white transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Users
            </button>
            <button className="px-6 py-2.5 border-2 border-[#4B5EFC] text-[#4B5EFC] rounded-lg font-medium hover:bg-[#4B5EFC] hover:text-white transition-all flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Manage Roles
            </button>
            <button className="px-6 py-2.5 border-2 border-[#4B5EFC] text-[#4B5EFC] rounded-lg font-medium hover:bg-[#4B5EFC] hover:text-white transition-all flex items-center gap-2">
              <Key className="w-4 h-4" />
              Manage Permissions
            </button>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Audit Logs */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Audit Logs</h3>
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#EEF0FF] rounded-full flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-[#4B5EFC]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium">{log.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{log.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent User Activity */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent User Activity</h3>
            <div className="space-y-4">
              {userActivity.map((user, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#E91E8C] to-[#4B5EFC] rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium truncate">{user.name}</p>
                    <p className="text-xs text-gray-500">
                      <span className={user.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      , {user.lastActive}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage Chart */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Resource Usage</h3>
            <div className="flex flex-col items-center">
              {/* Donut Chart */}
              <div className="relative w-48 h-48 mb-6">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#F3F4F6"
                    strokeWidth="12"
                  />
                  {/* Blue segment (35%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#4B5EFC"
                    strokeWidth="12"
                    strokeDasharray="87.96 251.2"
                    strokeDashoffset="0"
                  />
                  {/* Pink segment (27%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#E91E8C"
                    strokeWidth="12"
                    strokeDasharray="67.85 251.2"
                    strokeDashoffset="-87.96"
                  />
                  {/* Orange segment (23%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#FF8A3C"
                    strokeWidth="12"
                    strokeDasharray="57.78 251.2"
                    strokeDashoffset="-155.81"
                  />
                  {/* Yellow segment (15%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#FFA500"
                    strokeWidth="12"
                    strokeDasharray="37.68 251.2"
                    strokeDashoffset="-213.59"
                  />
                </svg>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#4B5EFC] rounded-sm"></div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">API Calls</p>
                    <p className="text-gray-500">(35%)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#E91E8C] rounded-sm"></div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Storage</p>
                    <p className="text-gray-500">(27%)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#FF8A3C] rounded-sm"></div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Workflows</p>
                    <p className="text-gray-500">(23%)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#FFA500] rounded-sm"></div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Users</p>
                    <p className="text-gray-500">(15%)</p>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
