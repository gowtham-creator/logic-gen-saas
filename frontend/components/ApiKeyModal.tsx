'use client';

import { useState, useEffect } from 'react';
import { Key, X, Plus, Trash2, Calendar, Gauge, Globe, Shield, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { ApiKey, ApiKeyModalProps } from '@/types';

const COMMON_SCOPES = [
  'users:read',
  'users:write',
  'roles:read',
  'roles:write',
  'api-keys:read',
  'api-keys:write',
  '*',
];

const COMMON_ENDPOINTS = [
  '/api/users',
  '/api/roles',
  '/api/api-keys',
  '/api/permissions',
];

export default function ApiKeyModal({ apiKey, onClose, onSave }: ApiKeyModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    scopes: [] as string[],
    allowedEndpoints: [] as string[],
    expiresAt: '',
    rateLimitPerMinute: 0,
  });
  const [customScope, setCustomScope] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (apiKey) {
      setFormData({
        name: apiKey.name || '',
        scopes: apiKey.scopes || [],
        allowedEndpoints: apiKey.allowedEndpoints || [],
        expiresAt: apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString().split('T')[0] : '',
        rateLimitPerMinute: apiKey.rateLimitPerMinute ?? 0,
      });
    } else {
      // Reset form for new API key
      setFormData({
        name: '',
        scopes: [],
        allowedEndpoints: [],
        expiresAt: '',
        rateLimitPerMinute: 0,
      });
    }
  }, [apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: any = {
        name: formData.name,
        scopes: formData.scopes.length > 0 ? formData.scopes : ['*'],
        allowedEndpoints: formData.allowedEndpoints.length > 0 ? formData.allowedEndpoints : [],
        rateLimitPerMinute: formData.rateLimitPerMinute || 0,
      };

      if (formData.expiresAt) {
        payload.expiresAt = new Date(formData.expiresAt).toISOString();
      } else if (apiKey?.id) {
        // Allow clearing expiration when updating
        payload.expiresAt = null;
      }

      if (apiKey?.id) {
        // Update existing API key
        const response = await apiClient.put<ApiKey>(API_ENDPOINTS.API_KEYS.BY_ID(apiKey.id), payload);
        notificationService.success(MESSAGES.SUCCESS.API_KEY_UPDATED);
        onSave(response);
        onClose();
      } else {
        // Create new API key
        const response = await apiClient.post<ApiKey>(API_ENDPOINTS.API_KEYS.BASE, payload);
        notificationService.success(MESSAGES.SUCCESS.API_KEY_CREATED);
        onSave(response);
        onClose();
      }
    } catch (err: any) {
      const errorMessage = err.message || MESSAGES.ERROR.SAVE_FAILED;
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleScope = (scope: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const toggleEndpoint = (endpoint: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedEndpoints: prev.allowedEndpoints.includes(endpoint)
        ? prev.allowedEndpoints.filter((e) => e !== endpoint)
        : [...prev.allowedEndpoints, endpoint],
    }));
  };

  const addCustomScope = () => {
    if (customScope.trim() && !formData.scopes.includes(customScope.trim())) {
      setFormData((prev) => ({
        ...prev,
        scopes: [...prev.scopes, customScope.trim()],
      }));
      setCustomScope('');
    }
  };

  const addCustomEndpoint = () => {
    if (customEndpoint.trim() && !formData.allowedEndpoints.includes(customEndpoint.trim())) {
      setFormData((prev) => ({
        ...prev,
        allowedEndpoints: [...prev.allowedEndpoints, customEndpoint.trim()],
      }));
      setCustomEndpoint('');
    }
  };

  const removeScope = (scope: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.filter((s) => s !== scope),
    }));
  };

  const removeEndpoint = (endpoint: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedEndpoints: prev.allowedEndpoints.filter((e) => e !== endpoint),
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
              <Key className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {apiKey ? 'Edit API Key' : 'Create API Key'}
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Production API Key"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="inline h-4 w-4 mr-1" />
              Scopes
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    formData.scopes.includes(scope)
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customScope}
                onChange={(e) => setCustomScope(e.target.value)}
                placeholder="Custom scope"
                className="input-field flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomScope();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomScope}
                className="btn-secondary flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
            {formData.scopes.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-2">Selected scopes:</div>
                <div className="flex flex-wrap gap-2">
                  {formData.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200"
                    >
                      {scope}
                      <button
                        type="button"
                        onClick={() => removeScope(scope)}
                        className="hover:text-blue-900 transition-colors"
                        aria-label={`Remove ${scope}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="inline h-4 w-4 mr-1" />
              Allowed Endpoints (leave empty for all)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_ENDPOINTS.map((endpoint) => (
                <button
                  key={endpoint}
                  type="button"
                  onClick={() => toggleEndpoint(endpoint)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    formData.allowedEndpoints.includes(endpoint)
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {endpoint}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="Custom endpoint (e.g., /api/custom)"
                className="input-field flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomEndpoint();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomEndpoint}
                className="btn-secondary flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
            {formData.allowedEndpoints.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-2">Selected endpoints:</div>
                <div className="flex flex-wrap gap-2">
                  {formData.allowedEndpoints.map((endpoint) => (
                    <span
                      key={endpoint}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-200"
                    >
                      {endpoint}
                      <button
                        type="button"
                        onClick={() => removeEndpoint(endpoint)}
                        className="hover:text-green-900 transition-colors"
                        aria-label={`Remove ${endpoint}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Expires At (optional)
              </label>
              <input
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Gauge className="inline h-4 w-4 mr-1" />
                Rate Limit (requests per minute, 0 = unlimited)
              </label>
              <input
                type="number"
                value={formData.rateLimitPerMinute}
                onChange={(e) => setFormData({ ...formData, rateLimitPerMinute: parseInt(e.target.value) || 0 })}
                min="0"
                className="input-field"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {apiKey?.id ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {apiKey?.id ? 'Update API Key' : 'Create API Key'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

