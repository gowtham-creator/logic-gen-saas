'use client';

import { X, Trash } from '@mynaui/icons-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  fileName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

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
            <h3 className="text-lg font-semibold text-gray-900">Delete File</h3>
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
            Are you sure you want to delete this file? This action cannot be undone.
          </p>

          {/* File Info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <Trash className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {fileName}
              </p>
              <p className="text-xs text-gray-500">Will be permanently deleted</p>
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
                <Trash className="w-4 h-4" />
                <span>Delete File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
