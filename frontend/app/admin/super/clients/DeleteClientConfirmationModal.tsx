'use client';

import { X } from 'lucide-react';

interface DeleteClientConfirmationModalProps {
  isOpen: boolean;
  client: {
    name: string;
    subdomain?: string;
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeleteClientConfirmationModal({
  isOpen,
  client,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteClientConfirmationModalProps) {
  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Client</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete this client? This will permanently delete all associated data including:
          </p>

          <ul className="text-sm text-gray-600 mb-4 space-y-1 pl-4">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              All users and their accounts
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              All workflows and files
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              All configurations and settings
            </li>
          </ul>

          {/* Client Info */}
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-900">
                {client.name}
              </p>
              {client.subdomain && (
                <p className="text-xs text-red-700 mt-0.5">
                  {client.subdomain}
                </p>
              )}
              <p className="text-xs text-red-700 font-medium mt-2">
                ⚠️ This action cannot be undone
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete Client</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
