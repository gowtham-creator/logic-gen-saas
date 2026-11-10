'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { AuditLog, AuditLogsResponse } from '@/types';
import { Loader2, FileSearch, Calendar, Filter, X } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.action, filters.resourceType, filters.startDate, filters.endDate]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.action) params.append('action', filters.action);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const data = await apiClient.get<AuditLogsResponse>(
        `${API_ENDPOINTS.AUDIT_LOGS.BASE}?${params.toString()}`
      );

      console.log('Audit logs response:', data);
      console.log('Number of logs received:', data.logs?.length);
      console.log('Pagination info:', data.pagination);
      console.log('Total logs:', data.pagination?.total);

      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters((prev) => {
      // Only reset to page 1 if it's not a page change
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

  const getActionColorClass = (action: string) => {
    if (action.includes('create')) return 'bg-green-50 text-green-700';
    if (action.includes('update')) return 'bg-blue-50 text-blue-700';
    if (action.includes('delete')) return 'bg-red-50 text-red-700';
    if (action.includes('login')) return 'bg-purple-50 text-purple-700';
    return 'bg-gray-50 text-gray-700';
  };

  const hasActiveFilters = filters.action || filters.resourceType || filters.startDate || filters.endDate;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-gray-500">
          Track all system activities and user actions in your organization
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilters({
                  action: '',
                  resourceType: '',
                  startDate: '',
                  endDate: '',
                  page: 1,
                  limit: 50,
                });
              }}
              className="ml-auto px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Action
            </label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              placeholder="e.g., role.created"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Resource Type
            </label>
            <input
              type="text"
              value={filters.resourceType}
              onChange={(e) => handleFilterChange('resourceType', e.target.value)}
              placeholder="e.g., Role, User"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Loading audit logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSearch className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Audit Logs Found</h3>
          <p className="text-gray-600">
            {hasActiveFilters ? 'Try adjusting your filters to see more results.' : MESSAGES.INFO.NO_DATA}
          </p>
        </div>
      ) : (
        <>
          {/* Debug info - remove in production */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <strong>Debug Info:</strong> Showing {logs.length} of {pagination.total} total logs (Page {pagination.page} of {pagination.totalPages})
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(log.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${getActionColorClass(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {log.user ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {log.user.firstName} {log.user.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {log.user.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">System</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {log.resourceType && (
                          <div>
                            <div className="font-medium text-gray-900">{log.resourceType}</div>
                            {log.resourceId && (
                              <div className="text-xs text-gray-500 font-mono">
                                ID: {log.resourceId.substring(0, 8)}...
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {log.ipAddress || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center mt-6 px-6 py-4 bg-white rounded-2xl border border-gray-100">
              <div className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFilterChange('page', pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-700 font-medium">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handleFilterChange('page', pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
