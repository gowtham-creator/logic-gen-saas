'use client';

import { useState, useEffect } from 'react';
import { CreditCard, X, CheckCircle, Shield, DollarSign, Calendar, Users, Key, Database } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { Plan, Permission, PlanModalProps } from '@/types';

export default function PlanModal({ plan, onClose, onSave }: PlanModalProps) {
  const [formData, setFormData] = useState<Plan>({
    name: '',
    description: '',
    price: undefined,
    billingPeriod: 'monthly',
    allowedPermissions: {},
    limits: {},
    databasePermissions: {
      allowedIsolationLevels: ['shared'],
      allowCustomTables: false,
      allowCustomColumns: false,
      allowCustomMigrations: false,
    },
    isActive: true,
  });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        description: plan.description || '',
        price: plan.price,
        billingPeriod: plan.billingPeriod || 'monthly',
        allowedPermissions: plan.allowedPermissions || {},
        limits: plan.limits || {},
        databasePermissions: plan.databasePermissions || {
          allowedIsolationLevels: ['shared'],
          allowCustomTables: false,
          allowCustomColumns: false,
          allowCustomMigrations: false,
        },
        isActive: plan.isActive !== undefined ? plan.isActive : true,
      });
    }
    loadPermissions();
  }, [plan]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Permission[]>('/api/permissions');
      setPermissions(data);
    } catch (err: any) {
      console.error('Failed to load permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (plan?.id) {
        await apiClient.put(`/api/plans/${plan.id}`, formData);
      } else {
        await apiClient.post('/api/plans', formData);
      }
      notificationService.success(
        plan?.id ? 'Plan updated successfully' : 'Plan created successfully'
      );
      onSave();
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save plan';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (resource: string, action: string) => {
    setFormData((prev) => {
      const current = prev.allowedPermissions[resource] || [];
      const updated = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];

      const newPermissions = { ...prev.allowedPermissions };
      if (updated.length > 0) {
        newPermissions[resource] = updated;
      } else {
        delete newPermissions[resource];
      }

      return {
        ...prev,
        allowedPermissions: newPermissions,
      };
    });
  };

  const updateLimit = (key: string, value: string) => {
    setFormData((prev) => {
      const newLimits = { ...prev.limits };
      if (value) {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
          newLimits[key] = numValue;
        }
      } else {
        // Remove the key if value is empty
        delete newLimits[key];
      }
      return {
        ...prev,
        limits: newLimits,
      };
    });
  };

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const isPermissionAllowed = (resource: string, action: string): boolean => {
    return formData.allowedPermissions[resource]?.includes(action) || false;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
              <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {plan?.id ? 'Edit Plan' : 'Create Plan'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="input-field"
                placeholder="e.g., Professional Plan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Price
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price || ''}
                onChange={(e) => setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="input-field"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="input-field"
              placeholder="Plan description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Billing Period
            </label>
            <select
              value={formData.billingPeriod}
              onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
              className="input-field"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limits
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Users className="inline h-3 w-3 mr-1" />
                  Max Users
                </label>
                <input
                  type="number"
                  value={formData.limits.users || ''}
                  onChange={(e) => updateLimit('users', e.target.value)}
                  className="input-field"
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Key className="inline h-3 w-3 mr-1" />
                  Max API Keys
                </label>
                <input
                  type="number"
                  value={formData.limits.apiKeys || ''}
                  onChange={(e) => updateLimit('apiKeys', e.target.value)}
                  className="input-field"
                  placeholder="Unlimited"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Database className="inline h-4 w-4 mr-1" />
              Database Permissions (What clients can configure)
            </label>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Allowed Isolation Levels
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.databasePermissions?.allowedIsolationLevels?.includes('shared') || false}
                      onChange={(e) => {
                        const current = formData.databasePermissions?.allowedIsolationLevels || [];
                        const updated: ('shared' | 'database')[] = e.target.checked
                          ? [...current.filter(l => l !== 'shared') as ('shared' | 'database')[], 'shared']
                          : current.filter(l => l !== 'shared') as ('shared' | 'database')[];
                        setFormData({
                          ...formData,
                          databasePermissions: {
                            ...formData.databasePermissions!,
                            allowedIsolationLevels: updated.length > 0 ? updated : ['shared'], // Always keep at least shared
                          },
                        });
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Shared Database</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.databasePermissions?.allowedIsolationLevels?.includes('database') || false}
                      onChange={(e) => {
                        const current = formData.databasePermissions?.allowedIsolationLevels || ['shared'];
                        const updated: ('shared' | 'database')[] = e.target.checked
                          ? [...current.filter(l => l !== 'database') as ('shared' | 'database')[], 'database']
                          : current.filter(l => l !== 'database') as ('shared' | 'database')[];
                        setFormData({
                          ...formData,
                          databasePermissions: {
                            ...formData.databasePermissions!,
                            allowedIsolationLevels: updated.length > 0 ? updated : ['shared'],
                          },
                        });
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Database-per-Tenant</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select which database isolation methods clients with this plan can use
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.databasePermissions?.allowCustomTables || false}
                    onChange={(e) => setFormData({
                      ...formData,
                      databasePermissions: {
                        ...formData.databasePermissions!,
                        allowCustomTables: e.target.checked,
                      },
                    })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Allow Custom Tables</span>
                </label>

                {formData.databasePermissions?.allowCustomTables && (
                  <div className="ml-6">
                    <label className="block text-xs text-gray-600 mb-1">
                      Max Custom Tables (per client)
                    </label>
                    <input
                      type="number"
                      value={formData.databasePermissions?.maxCustomTables || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        databasePermissions: {
                          ...formData.databasePermissions!,
                          maxCustomTables: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        },
                      })}
                      className="input-field text-sm"
                      placeholder="Unlimited"
                      min="1"
                    />
                  </div>
                )}

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.databasePermissions?.allowCustomColumns || false}
                    onChange={(e) => setFormData({
                      ...formData,
                      databasePermissions: {
                        ...formData.databasePermissions!,
                        allowCustomColumns: e.target.checked,
                      },
                    })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Allow Custom Columns</span>
                </label>

                {formData.databasePermissions?.allowCustomColumns && (
                  <div className="ml-6">
                    <label className="block text-xs text-gray-600 mb-1">
                      Max Custom Columns per Table (per client)
                    </label>
                    <input
                      type="number"
                      value={formData.databasePermissions?.maxCustomColumns || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        databasePermissions: {
                          ...formData.databasePermissions!,
                          maxCustomColumns: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        },
                      })}
                      className="input-field text-sm"
                      placeholder="Unlimited"
                      min="1"
                    />
                  </div>
                )}

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.databasePermissions?.allowCustomMigrations || false}
                    onChange={(e) => setFormData({
                      ...formData,
                      databasePermissions: {
                        ...formData.databasePermissions!,
                        allowCustomMigrations: e.target.checked,
                      },
                    })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Allow Custom Migrations</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="inline h-4 w-4 mr-1" />
              Allowed Permissions (by Resource)
            </label>
            <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-auto bg-gray-50">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource} className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 capitalize flex items-center">
                      <Shield className="h-4 w-4 mr-1 text-primary-600" />
                      {resource}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className={`flex items-center px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                            isPermissionAllowed(resource, perm.action)
                              ? 'bg-primary-50 border-primary-300 text-primary-700'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isPermissionAllowed(resource, perm.action)}
                            onChange={() => togglePermission(resource, perm.action)}
                            className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-sm">{perm.action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive !== false}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

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
              disabled={saving}
              className={`btn-primary ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {plan?.id ? 'Update Plan' : 'Create Plan'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

