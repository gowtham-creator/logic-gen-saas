'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Code,
  ArrowLeft,
  FileText,
  Loader2,
  Search,
  Filter
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { AuditLog, AuditLogsResponse } from '@/types';
import Header from '@/components/Header';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  plan: {
    id: string;
    name: string;
  } | null;
}

export default function TenantAuditLogsPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params?.tenantId as string;
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    page: 1,
    limit: 100,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isAuth = isAuthenticated();
    const isDeveloper = localStorage.getItem('isDeveloper') === 'true';
    
    if (!isAuth || !isDeveloper) {
      router.push('/login');
      return;
    }
    
    if (tenantId) {
      loadData();
    }
  }, [router, tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.action, filters.resourceType, tenantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load tenant details
      const tenantData = await apiClient.get<Tenant>(`/api/developer/tenants/${tenantId}`);
      setTenant(tenantData);
      
      // Load audit logs
      await loadLogs();
    } catch (error: any) {
      console.error('Error loading data:', error);
      
      if (error.response?.status === 403) {
        notificationService.error('Developer access denied');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('isDeveloper');
        }
        router.push('/login');
        return;
      }
      
      if (error.response?.status === 401) {
        notificationService.error('Authentication failed');
        router.push('/login');
        return;
      }
      
      notificationService.error(error.response?.data?.error?.message || error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams();
      
      if (filters.action) params.append('action', filters.action);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const data = await apiClient.get<AuditLogsResponse>(
        `/api/developer/tenants/${tenantId}/audit-logs?${params.toString()}`
      );
      
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      notificationService.error('Failed to load audit logs');
    }
  };

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters((prev) => {
      if (key === 'page') {
        return { ...prev, [key]: value as number };
      }
      return { ...prev, [key]: value, page: 1 };
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAction = (action: string) => {
    return action.replace(/\./g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-100 text-green-800';
    if (action.includes('update')) return 'bg-blue-100 text-blue-800';
    if (action.includes('delete')) return 'bg-red-100 text-red-800';
    if (action.includes('login')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading && !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title={tenant ? `Audit Logs - ${tenant.name}` : 'Audit Logs'}
        subtitle="View tenant audit logs"
        icon={FileText}
        iconBg="from-blue-500 to-blue-600"
      />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/developer/dashboard')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Dashboard</span>
        </button>

        {/* Tenant Info */}
        {tenant && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{tenant.name}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Subdomain: {tenant.subdomain}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                tenant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {tenant.isActive ? 'Active' : 'Inactive'}
              </span>
              {tenant.plan && (
                <span>Plan: {tenant.plan.name}</span>
              )}
            </div>
          </div>
        )}

        {/* Audit Logs Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
            </div>
          </div>

          {/* Filters */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action
                </label>
                <input
                  type="text"
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  placeholder="e.g., role.created"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resource Type
                </label>
                <input
                  type="text"
                  value={filters.resourceType}
                  onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                  placeholder="e.g., Role, User"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({
                      action: '',
                      resourceType: '',
                      page: 1,
                      limit: 100,
                    });
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No audit logs found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                            {formatAction(log.action)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {log.user ? (
                            <div>
                              <div className="font-medium text-gray-900">
                                {log.user.firstName} {log.user.lastName}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {log.user.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">System</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {log.resourceType && (
                            <div>
                              <div className="font-medium text-gray-900">{log.resourceType}</div>
                              {log.resourceId && (
                                <div className="text-gray-500 text-xs">
                                  ID: {log.resourceId.substring(0, 8)}...
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ipAddress || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                  <div className="text-sm text-gray-700">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} entries
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleFilterChange('page', pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        pagination.page === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-700">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handleFilterChange('page', pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        pagination.page === pagination.totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

