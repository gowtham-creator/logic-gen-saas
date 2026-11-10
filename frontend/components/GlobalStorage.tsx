'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';

interface StorageEngine {
  id: string;
  type: string;
  name: string;
  description?: string;
  defaultConfig?: Record<string, unknown>;
}

interface StorageConfig {
  id: string;
  storageEngineId: string;
  config: Record<string, unknown>;
  isActive: boolean;
  isDefault: boolean;
  storageEngine?: StorageEngine;
}

export default function GlobalStorage() {
  const [storageEngines, setStorageEngines] = useState<StorageEngine[]>([]);
  const [storageConfig, setStorageConfig] = useState<StorageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEngineId, setSelectedEngineId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [enginesData, configData] = await Promise.all([
        apiClient.get<StorageEngine[]>('/api/storage/engines'),
        apiClient.get<StorageConfig | null>('/api/storage/default'),
      ]);
      setStorageEngines(enginesData);
      if (configData) {
        setStorageConfig(configData);
        setSelectedEngineId(configData.storageEngineId);
      } else if (enginesData.length > 0) {
        setSelectedEngineId(enginesData[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load storage data:', error);
      notificationService.error(error.message || 'Failed to load storage configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedEngineId) {
      notificationService.error('Please select a storage engine');
      return;
    }

    const engine = storageEngines.find(e => e.id === selectedEngineId);
    if (!engine) {
      notificationService.error('Selected storage engine not found');
      return;
    }

    // Build config based on engine type
    const config: Record<string, unknown> = { ...(storageConfig?.config || {}) };

    // Validate required fields based on engine type
    if (engine.type === 's3') {
      if (!config.accessKeyId || !config.secretAccessKey || !config.bucket) {
        notificationService.error('Please fill in all required S3 fields');
        return;
      }
    } else if (engine.type === 'azure') {
      if (!config.accountName || !config.accountKey || !config.containerName) {
        notificationService.error('Please fill in all required Azure fields');
        return;
      }
    } else if (engine.type === 'local') {
      if (!config.basePath) {
        notificationService.error('Please specify a base path for local storage');
        return;
      }
    }

    try {
      setSaving(true);
      await apiClient.post('/api/storage/default', {
        storageEngineId: selectedEngineId,
        config,
      });
      notificationService.success('Global storage configuration saved successfully');
      loadData();
    } catch (error: any) {
      console.error('Failed to save storage configuration:', error);
      notificationService.error(error.message || 'Failed to save storage configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setStorageConfig({
      ...(storageConfig || {
        id: '',
        storageEngineId: selectedEngineId,
        config: {},
        isActive: true,
        isDefault: true,
      }),
      config: {
        ...(storageConfig?.config || {}),
        [key]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B5FC7]"></div>
        <p className="mt-2 text-gray-600">Loading storage configuration...</p>
      </div>
    );
  }

  const selectedEngine = storageEngines.find(e => e.id === selectedEngineId);
  const engineType = selectedEngine?.type;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This configuration serves as the default storage location for all clients. Clients without custom storage settings will use this configuration.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="space-y-6">
          {/* Storage Engine Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Storage Engine *
            </label>
            <select
              value={selectedEngineId}
              onChange={(e) => {
                setSelectedEngineId(e.target.value);
                setStorageConfig(null); // Reset config when engine changes
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
              required
            >
              <option value="">Select a storage engine</option>
              {storageEngines.map((engine) => (
                <option key={engine.id} value={engine.id}>
                  {engine.name} ({engine.type})
                </option>
              ))}
            </select>
            {selectedEngine && selectedEngine.description && (
              <p className="mt-1 text-xs text-gray-500">{selectedEngine.description}</p>
            )}
          </div>

          {/* Storage Configuration Fields */}
          {selectedEngine && (
            <div className="space-y-4">
              {engineType === 's3' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Key ID *
                    </label>
                    <input
                      type="text"
                      value={(storageConfig?.config?.accessKeyId as string) || ''}
                      onChange={(e) => updateConfig('accessKeyId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Secret Access Key *
                    </label>
                    <input
                      type="password"
                      value={(storageConfig?.config?.secretAccessKey as string) || ''}
                      onChange={(e) => updateConfig('secretAccessKey', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Region *
                    </label>
                    <input
                      type="text"
                      value={(storageConfig?.config?.region as string) || 'us-east-1'}
                      onChange={(e) => updateConfig('region', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="us-east-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bucket Name *
                    </label>
                    <input
                      type="text"
                      value={(storageConfig?.config?.bucket as string) || ''}
                      onChange={(e) => updateConfig('bucket', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="my-bucket"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endpoint (optional - for S3-compatible services)
                    </label>
                    <input
                      type="text"
                      value={(storageConfig?.config?.endpoint as string) || ''}
                      onChange={(e) => updateConfig('endpoint', e.target.value || undefined)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="https://s3.amazonaws.com"
                    />
                  </div>
                </div>
              )}

              {engineType === 'azure' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      value={(storageConfig?.config?.accountName as string) || ''}
                      onChange={(e) => updateConfig('accountName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="mystorageaccount"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Key *
                    </label>
                    <input
                      type="password"
                      value={(storageConfig?.config?.accountKey as string) || ''}
                      onChange={(e) => updateConfig('accountKey', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="Account key"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Container Name *
                    </label>
                    <input
                      type="text"
                      value={(storageConfig?.config?.containerName as string) || ''}
                      onChange={(e) => updateConfig('containerName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                      placeholder="my-container"
                      required
                    />
                  </div>
                </div>
              )}

              {engineType === 'local' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Path *
                  </label>
                  <input
                    type="text"
                    value={(storageConfig?.config?.basePath as string) || './storage'}
                    onChange={(e) => updateConfig('basePath', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent"
                    placeholder="./storage"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Local file system path where files will be stored
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Status Indicator */}
          {storageConfig && (
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              {storageConfig.isActive ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Global storage is active and configured</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-gray-700">Global storage is inactive</span>
                </>
              )}
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || !selectedEngineId}
              className="px-6 py-2.5 bg-[#5B5FC7] hover:bg-[#4B4CB2] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Global Storage Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
