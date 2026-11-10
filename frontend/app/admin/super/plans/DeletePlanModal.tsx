'use client';

import { X } from 'lucide-react';

interface DeletePlanModalProps {
  isOpen: boolean;
  plan: {
    name: string;
    price?: number;
    billingPeriod?: string;
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeletePlanModal({
  isOpen,
  plan,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeletePlanModalProps) {
  if (!isOpen || !plan) return null;

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
            <h3 className="text-lg font-semibold text-gray-900">Delete Plan</h3>
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
            Are you sure you want to delete this plan? This will affect all clients currently using this plan.
          </p>

          <ul className="text-sm text-gray-600 mb-4 space-y-1 pl-4">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              All plan configurations and settings
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Associated permissions and database settings
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Client assignments (clients will need a new plan)
            </li>
          </ul>

          {/* Plan Info */}
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-900">
                {plan.name}
              </p>
              {plan.price !== undefined && (
                <p className="text-xs text-red-700 mt-0.5">
                  ${plan.price}/{plan.billingPeriod || 'month'}
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
                <span>Delete Plan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
