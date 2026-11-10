'use client';

import { X } from '@mynaui/icons-react';
import { useState } from 'react';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export default function CreateWorkspaceModal({ isOpen, onClose, onSubmit }: CreateWorkspaceModalProps) {
  const [workspaceName, setWorkspaceName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (workspaceName.trim()) {
      onSubmit(workspaceName.trim());
      setWorkspaceName('');
      onClose();
    }
  };

  const handleClose = () => {
    setWorkspaceName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Create Workspace</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6">
            <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-700 mb-2">
              Workspace Name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Enter workspace name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!workspaceName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
