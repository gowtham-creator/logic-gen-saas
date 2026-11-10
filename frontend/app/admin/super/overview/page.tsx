'use client';

import { useEffect, useState } from 'react';
import { Building2, CreditCard, HardDrive, Plus, Settings, Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Stats {
  totalClients: number;
  activePlans: number;
  systemUsers: number;
}

interface AuditLog {
  id: string;
  message: string;
  timestamp: string;
}

interface ClientActivity {
  name: string;
  logo?: string;
  status: 'active' | 'inactive' | 'expired';
  lastActive: string;
}

export default function SuperAdminOverviewPage() {
  const user = getStoredUser();
  const [stats, setStats] = useState<Stats>({ totalClients: 0, activePlans: 0, systemUsers: 0 });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [clientActivity, setClientActivity] = useState<ClientActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Load clients data
      const clients = await apiClient.get('/api/clients');

      setStats({
        totalClients: Array.isArray(clients) ? clients.length : 0,
        activePlans: 12, // Mock data
        systemUsers: 24, // Mock data
      });

      // Mock audit logs
      setAuditLogs([
        { id: '1', message: 'No.of Clients', timestamp: '' },
        { id: '2', message: 'Storage at 85%', timestamp: '' },
        { id: '3', message: 'Client subscription expiring soon', timestamp: '' },
        { id: '4', message: 'New feature update available', timestamp: '' },
        { id: '5', message: 'Pending invoices need attention', timestamp: '' },
        { id: '6', message: 'System maintenance scheduled for tonight', timestamp: '' },
      ]);

      // Mock client activity
      setClientActivity([
        { name: 'ICICI Lombard', status: 'active', lastActive: 'Today' },
        { name: 'Citi Bank', status: 'inactive', lastActive: '2 days ago' },
        { name: 'HDFC Insurance', status: 'active', lastActive: 'Today' },
        { name: 'Credit Suisse', status: 'expired', lastActive: '3 days ago' },
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const userName = user?.firstName || user?.email?.split('@')[0] || 'Super Admin';

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
          {/* Clients Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-2">No.of Clients</p>
                <p className="text-4xl font-bold text-[#4B5EFC]">{stats.totalClients}</p>
              </div>
              <div className="w-12 h-12 bg-[#EEF0FF] rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#4B5EFC]" />
              </div>
            </div>
          </div>

          {/* Plans Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-2">No.of Active Plans</p>
                <p className="text-4xl font-bold text-[#FF8A3C]">{stats.activePlans}</p>
              </div>
              <div className="w-12 h-12 bg-[#FFF4ED] rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-[#FF8A3C]" />
              </div>
            </div>
          </div>

          {/* System Users Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-2">No.of System Users</p>
                <p className="text-4xl font-bold text-[#A855F7]">{stats.systemUsers}</p>
              </div>
              <div className="w-12 h-12 bg-[#F5EFFF] rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-[#A855F7]" />
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
              Add Client
            </button>
            <button className="px-6 py-2.5 border-2 border-[#4B5EFC] text-[#4B5EFC] rounded-lg font-medium hover:bg-[#4B5EFC] hover:text-white transition-all flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Manage Plans
            </button>
            <button className="px-6 py-2.5 border-2 border-[#4B5EFC] text-[#4B5EFC] rounded-lg font-medium hover:bg-[#4B5EFC] hover:text-white transition-all flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              View Storage
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
                    <Building2 className="w-4 h-4 text-[#4B5EFC]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium">{log.message}</p>
                    {log.timestamp && <p className="text-xs text-gray-500 mt-1">{log.timestamp}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Client Activity */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Client Activity</h3>
            <div className="space-y-4">
              {clientActivity.map((client, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#E91E8C] to-[#4B5EFC] rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs">
                    {client.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium truncate">{client.name}</p>
                    <p className="text-xs">
                      <span
                        className={
                          client.status === 'active'
                            ? 'text-green-600'
                            : client.status === 'expired'
                            ? 'text-red-600'
                            : 'text-gray-400'
                        }
                      >
                        {client.status === 'active' ? 'Active' : client.status === 'expired' ? 'Expired' : 'Inactive'}
                      </span>
                      , {client.lastActive}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Usage Chart */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Plan Usage</h3>
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
                    <p className="text-gray-900 font-medium">Free</p>
                    <p className="text-gray-500">(35%)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#E91E8C] rounded-sm"></div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Basic</p>
                    <p className="text-gray-500">(27%)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#FF8A3C] rounded-sm"></div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Pro</p>
                    <p className="text-gray-500">(23%)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#FFA500] rounded-sm"></div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Enterprise</p>
                    <p className="text-gray-500">(15%)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Usage */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Primary (S3)</p>
                <p className="text-sm font-medium text-gray-900">400GB / 1TB used</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-[#E91E8C] to-[#4B5EFC] h-2.5 rounded-full" style={{ width: '40%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
