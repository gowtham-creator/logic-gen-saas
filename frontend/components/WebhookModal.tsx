'use client';

import { useState, useEffect } from 'react';
import { Webhook, WebhookEventType, CreateWebhookDto, UpdateWebhookDto } from '@/types';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import PasswordInput from '@/components/PasswordInput';

interface WebhookModalProps {
  webhook?: Webhook | null;
  onClose: () => void;
  onSave: () => void;
}

const ALL_EVENTS: WebhookEventType[] = [
  'user.created',
  'user.updated',
  'user.deleted',
  'user.activated',
  'user.deactivated',
  'role.created',
  'role.updated',
  'role.deleted',
  'role.permissions.updated',
  'apiKey.created',
  'apiKey.updated',
  'apiKey.revoked',
  'apiKey.deleted',
  'permission.created',
  'permission.updated',
  'auditLog.created',
];

export default function WebhookModal({ webhook, onClose, onSave }: WebhookModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as WebhookEventType[],
    secret: '',
    isActive: true,
    maxRetries: 3,
    timeoutMs: 5000,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (webhook) {
      setFormData({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: '', // Don't show existing secret
        isActive: webhook.isActive,
        maxRetries: webhook.maxRetries,
        timeoutMs: webhook.timeoutMs,
      });
    } else {
      setFormData({
        name: '',
        url: '',
        events: [],
        secret: '',
        isActive: true,
        maxRetries: 3,
        timeoutMs: 5000,
      });
    }
  }, [webhook]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: CreateWebhookDto | UpdateWebhookDto = {
        name: formData.name,
        url: formData.url,
        events: formData.events,
        isActive: formData.isActive,
        maxRetries: formData.maxRetries,
        timeoutMs: formData.timeoutMs,
      };

      if (formData.secret) {
        payload.secret = formData.secret;
      }

      if (webhook?.id) {
        await apiClient.put<Webhook>(API_ENDPOINTS.WEBHOOKS.BY_ID(webhook.id), payload);
        notificationService.success('Webhook updated successfully');
      } else {
        await apiClient.post<Webhook>(API_ENDPOINTS.WEBHOOKS.BASE, payload);
        notificationService.success('Webhook created successfully');
      }

      onSave();
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || MESSAGES.ERROR.SAVE_FAILED;
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (event: WebhookEventType) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const toggleAllEvents = () => {
    if (formData.events.length === ALL_EVENTS.length) {
      setFormData((prev) => ({ ...prev, events: [] }));
    } else {
      setFormData((prev) => ({ ...prev, events: [...ALL_EVENTS] }));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
          {webhook ? 'Edit Webhook' : 'Create Webhook'}
        </h2>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Webhook URL *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              required
              placeholder="https://example.com/webhooks"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Secret (for HMAC signature)
            </label>
            <PasswordInput
              value={formData.secret}
              onChange={(e) => setFormData((prev) => ({ ...prev, secret: e.target.value }))}
              placeholder={webhook ? 'Leave empty to keep existing secret' : 'Optional'}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              autoComplete="off"
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Used to verify webhook authenticity via HMAC SHA-256 signature
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Events *</label>
              <button
                type="button"
                onClick={toggleAllEvents}
                style={{
                  fontSize: '0.75rem',
                  color: '#3b82f6',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {formData.events.length === ALL_EVENTS.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                padding: '0.75rem',
                maxHeight: '200px',
                overflow: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem',
              }}
            >
              {ALL_EVENTS.map((event) => (
                <label
                  key={event}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  <span>{event}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Max Retries
              </label>
              <input
                type="number"
                value={formData.maxRetries}
                onChange={(e) => setFormData((prev) => ({ ...prev, maxRetries: parseInt(e.target.value) || 0 }))}
                min="0"
                max="10"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Timeout (ms)
              </label>
              <input
                type="number"
                value={formData.timeoutMs}
                onChange={(e) => setFormData((prev) => ({ ...prev, timeoutMs: parseInt(e.target.value) || 5000 }))}
                min="1000"
                max="60000"
                step="1000"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <span>Active</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || formData.events.length === 0}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: loading || formData.events.length === 0 ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || formData.events.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {loading ? 'Saving...' : webhook ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

