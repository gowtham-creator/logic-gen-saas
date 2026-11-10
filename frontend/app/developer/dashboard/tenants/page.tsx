'use client';

import { useState, useEffect } from 'react';
import { Building2, Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

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

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ tenants: Tenant[] }>('/api/developer/tenants');
      setTenants(data?.tenants || []);
    } catch (error: any) {
      console.error('Failed to load tenants:', error);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Tenants</h2>
          <p className="text-gray-600 mt-1">Manage and view all tenant organizations</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
          />
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm ? 'No tenants found matching your search' : 'No tenants yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/developer/tenants/${tenant.id}/audit-logs`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                    <p className="text-sm text-gray-500">{tenant.subdomain}</p>
                  </div>
                </div>
                {tenant.isActive ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              {tenant.plan && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Plan: <span className="font-medium">{tenant.plan.name}</span>
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center text-blue-600 hover:text-blue-700">
                <Eye className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">View Audit Logs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

