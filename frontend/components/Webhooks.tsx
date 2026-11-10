'use client';

import { useState, useEffect } from 'react';
import { Webhook, WebhookEvent } from '@/types';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';
import WebhookModal from './WebhookModal';
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw, Eye, Loader2, X } from 'lucide-react';

export default function Webhooks() {
  const { hasPermission } = usePermissions();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Webhook[]>(API_ENDPOINTS.WEBHOOKS.BASE);
      setWebhooks(data);
    } catch (error: any) {
      console.error('Failed to load webhooks:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (webhookId: string) => {
    try {
      setLoadingEvents(true);
      const data = await apiClient.get<WebhookEvent[]>(API_ENDPOINTS.WEBHOOKS.EVENTS(webhookId));
      setEvents(data);
    } catch (error: any) {
      console.error('Failed to load webhook events:', error);
      notificationService.error('Failed to load webhook events');
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleCreate = () => {
    setEditingWebhook(null);
    setShowModal(true);
  };

  const handleEdit = async (webhook: Webhook) => {
    try {
      const fullWebhook = await apiClient.get<Webhook>(API_ENDPOINTS.WEBHOOKS.BY_ID(webhook.id));
      setEditingWebhook(fullWebhook);
      setShowModal(true);
    } catch (error: any) {
      console.error('Failed to load webhook details:', error);
      notificationService.error(MESSAGES.ERROR.LOAD_FAILED);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(MESSAGES.WARNING.CONFIRM_DELETE('webhook'))) {
      return;
    }
    try {
      await apiClient.delete(API_ENDPOINTS.WEBHOOKS.BY_ID(id));
      notificationService.success('Webhook deleted successfully');
      loadWebhooks();
    } catch (error: any) {
      notificationService.error(error.message || MESSAGES.ERROR.DELETE_FAILED);
    }
  };

  const handleRetryEvent = async (eventId: string) => {
    try {
      await apiClient.post(API_ENDPOINTS.WEBHOOKS.RETRY_EVENT(eventId));
      notificationService.success('Webhook event retry initiated');
      if (selectedWebhook) {
        loadEvents(selectedWebhook.id);
      }
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to retry webhook event');
    }
  };

  const handleViewEvents = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    await loadEvents(webhook.id);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'retrying':
        return <RefreshCw className="w-4 h-4 text-amber-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 text-green-700';
      case 'failed':
        return 'bg-red-50 text-red-700';
      case 'retrying':
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#4B4CB2' }}>Webhooks</h1>
          <p className="text-sm text-gray-500">
            Configure webhooks to receive real-time notifications about events in your organization
          </p>
        </div>
        {hasPermission(PERMISSION_RESOURCES.WEBHOOK, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_WEBHOOK) && (
          <button
            onClick={handleCreate}
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md"
          >
            <Activity className="h-4 w-4" />
            <span>Create Webhook</span>
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Loading webhooks...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Webhooks Yet</h3>
          <p className="text-gray-600 mb-6">
            {MESSAGES.INFO.NO_DATA}
          </p>
          {hasPermission(PERMISSION_RESOURCES.WEBHOOK, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_CREATE_WEBHOOK) && (
            <button
              onClick={handleCreate}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm"
            >
              Create Your First Webhook
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{webhook.name}</h3>
                    {webhook.isActive ? (
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">URL:</span> {webhook.url}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {webhook.events.map((event, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">
                    Created: {formatDate(webhook.createdAt)} | Max Retries: {webhook.maxRetries} | Timeout: {webhook.timeoutMs}ms
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewEvents(webhook)}
                    className="p-2 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
                    title="View Events"
                  >
                    <Eye className="w-4 h-4 text-gray-600" />
                  </button>
                  {hasPermission(PERMISSION_RESOURCES.WEBHOOK, PERMISSION_ACTIONS.UPDATE, ELEMENT_IDS.BTN_EDIT_WEBHOOK) && (
                    <button
                      onClick={() => handleEdit(webhook)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {hasPermission(PERMISSION_RESOURCES.WEBHOOK, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_WEBHOOK) && (
                    <button
                      onClick={() => handleDelete(webhook.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Events Modal */}
      {selectedWebhook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedWebhook(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Webhook Events: {selectedWebhook.name}
              </h2>
              <button
                onClick={() => setSelectedWebhook(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-8">
              {loadingEvents ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                  <p className="text-gray-600">Loading events...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600">No events yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 border border-gray-200 rounded-xl bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(event.status)}
                            <span className="font-semibold text-sm text-gray-900">{event.eventType}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusColor(event.status)}`}>
                              {event.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Attempts: {event.attemptCount} | Created: {formatDate(event.createdAt)}
                            {event.deliveredAt && ` | Delivered: ${formatDate(event.deliveredAt)}`}
                          </div>
                        </div>
                        {event.status === 'failed' && (
                          <button
                            onClick={() => handleRetryEvent(event.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}
                      </div>
                      {event.errorMessage && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                          <span className="font-medium">Error:</span> {event.errorMessage}
                        </div>
                      )}
                      {event.httpStatus && (
                        <div className="mt-2 text-xs text-gray-600">
                          HTTP Status: {event.httpStatus}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <WebhookModal
          webhook={editingWebhook}
          onClose={() => {
            setShowModal(false);
            setEditingWebhook(null);
          }}
          onSave={() => {
            loadWebhooks();
            setShowModal(false);
            setEditingWebhook(null);
          }}
        />
      )}
    </div>
  );
}
