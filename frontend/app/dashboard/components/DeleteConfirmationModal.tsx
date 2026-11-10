// components/workflow/DeleteConfirmationModal.tsx
'use client';

import { X, Trash, DangerTriangle } from '@mynaui/icons-react';
import { useState } from 'react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  workspaceName: string;
  title?: string;
  message?: string;
  loading?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  workspaceName,
  title = 'Delete Workflow',
  message = 'This action cannot be undone. All data and files associated with this workflow will be permanently removed.',
  loading = false,
}: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
      // onClose() is handled in parent after success
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center">
              <DangerTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <p className="text-sm font-medium text-red-900 mb-1">
              Warning: This action is irreversible
            </p>
            <p className="text-sm text-red-800">
              Are you sure you want to delete{' '}
              <span className="font-bold">"{workspaceName}"</span>?
            </p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50/70 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-6 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash className="w-4 h-4" />
                Delete Workflow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}