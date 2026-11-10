'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Users, Building2, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface SystemStats {
  tenants: {
    total: number;
    active: number;
  };
  users: {
    total: number;
    active: number;
  };
  auditLogs: {
    total: number;
    recentErrors: number;
  };
}

export default function OverviewPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<SystemStats>('/api/developer/stats');
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">No statistics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tenants</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.tenants.total}</p>
              <p className="text-sm text-green-600 mt-1">
                {stats.tenants.active} active
              </p>
            </div>
            <Building2 className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.users.total}</p>
              <p className="text-sm text-green-600 mt-1">
                {stats.users.active} active
              </p>
            </div>
            <Users className="h-12 w-12 text-purple-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Audit Logs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.auditLogs.total}</p>
              {stats.auditLogs.recentErrors > 0 && (
                <p className="text-sm text-red-600 mt-1">
                  {stats.auditLogs.recentErrors} recent errors
                </p>
              )}
            </div>
            <Activity className="h-12 w-12 text-orange-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

