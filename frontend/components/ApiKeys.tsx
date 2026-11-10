'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Copy, Check, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';
import ApiKeyModal from './ApiKeyModal';
import { ApiKey } from '@/types';

export default function ApiKeys() {
  const { hasPermission } = usePermissions();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [showApiKey, setShowApiKey] = useState<{ id: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<ApiKey[]>(API_ENDPOINTS.API_KEYS.BASE);
      setApiKeys(data);
    } catch (error: any) {
      console.error('Failed to load API keys:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingKey(null);
    setShowModal(true);
  };

  const handleEdit = async (key: ApiKey) => {
    try {
      const fullKey = await apiClient.get<ApiKey>(API_ENDPOINTS.API_KEYS.BY_ID(key.id));
      setEditingKey(fullKey);
      setShowModal(true);
    } catch (error: any) {
      console.error('Failed to load API key details:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(MESSAGES.WARNING.CONFIRM_DELETE('API key'))) {
      return;
    }
    try {
      await apiClient.put(API_ENDPOINTS.API_KEYS.REVOKE(id));
      notificationService.success(MESSAGES.SUCCESS.API_KEY_REVOKED);
      loadApiKeys();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.DELETE_FAILED);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(MESSAGES.WARNING.CONFIRM_DELETE('API key'))) {
      return;
    }
    try {
      await apiClient.delete(API_ENDPOINTS.API_KEYS.BY_ID(id));
      notificationService.success(MESSAGES.SUCCESS.API_KEY_DELETED);
      loadApiKeys();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.DELETE_FAILED);
    }
  };

  const handleModalSave = (newKey?: ApiKey) => {
    loadApiKeys();
    if (newKey?.apiKey) {
      setShowApiKey({ id: newKey.id, key: newKey.apiKey });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleOpenApiDocs = () => {
    // Get token from localStorage if user is authenticated
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    // Use relative URL - Next.js rewrite will proxy to backend
    let docsUrl = '/api-docs';

    // If user has a token, pass it as a query parameter
    // The backend can use this to pre-authenticate the Swagger UI
    if (token) {
      docsUrl += `?token=${encodeURIComponent(token)}`;
    }

    window.open(docsUrl, '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        notificationService.success('API key copied to clipboard');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          notificationService.success('API key copied to clipboard');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          notificationService.error('Failed to copy to clipboard');
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      notificationService.error('Failed to copy to clipboard');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#4B4CB2' }}>API Keys</h1>
          <p className="text-sm text-gray-500">Manage your API authentication keys</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleOpenApiDocs}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md"
            title="Open API Documentation in a new window"
          >
            <BookOpen className="h-4 w-4" />
            <span>API Documentation</span>
          </button>
          {hasPermission(PERMISSION_RESOURCES.API_KEY, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_API_KEY) && (
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md"
            >
              <span>Create API Key</span>
            </button>
          )}
        </div>
      </div>

      {/* API Key Display Modal */}
      {showApiKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => setShowApiKey(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              API Key Created
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-800 font-medium">
                ⚠️ Please copy your API key now. You won't be able to see it again!
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
              <code className="text-sm font-mono text-gray-900 break-all">
                {showApiKey.key}
              </code>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(showApiKey.key)}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </button>
              <button
                onClick={() => setShowApiKey(null)}
                className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium text-sm transition-colors"
              >
                I've Copied It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Loading API keys...</p>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No API Keys Yet</h3>
          <p className="text-gray-600 mb-6">
            {MESSAGES.INFO.NO_DATA}
          </p>
          {hasPermission(PERMISSION_RESOURCES.API_KEY, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_API_KEY) && (
            <button
              onClick={handleCreate}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm"
            >
              Create Your First API Key
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Scopes
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apiKeys.map((key) => (
                  <tr
                    key={key.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{key.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {key.scopes.length > 0 ? (
                          <>
                            {key.scopes.slice(0, 3).map((scope, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium"
                              >
                                {scope}
                              </span>
                            ))}
                            {key.scopes.length > 3 && (
                              <span className="text-gray-500 text-xs">
                                +{key.scopes.length - 3} more
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">No scopes</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {key.isRevoked ? (
                        <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                          Revoked
                        </span>
                      ) : isExpired(key.expiresAt) ? (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">
                          Expired
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(key.expiresAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(key.lastUsedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {!key.isRevoked && hasPermission(PERMISSION_RESOURCES.API_KEY, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_API_KEY) && (
                          <button
                            onClick={() => handleEdit(key)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {!key.isRevoked && hasPermission(PERMISSION_RESOURCES.API_KEY, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_API_KEY) && (
                          <button
                            onClick={() => handleRevoke(key.id)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                        {hasPermission(PERMISSION_RESOURCES.API_KEY, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_API_KEY) && (
                          <button
                            onClick={() => handleDelete(key.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ApiKeyModal
          apiKey={editingKey}
          onClose={() => {
            setShowModal(false);
            setEditingKey(null);
          }}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
