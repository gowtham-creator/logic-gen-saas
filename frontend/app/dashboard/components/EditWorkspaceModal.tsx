'use client';

import { X } from '@mynaui/icons-react';
import { useState, useEffect } from 'react';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isActive: boolean;
}

interface EditWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void> | void;
  workflow: Workflow | null;
}

export default function EditWorkflowModal({
  isOpen,
  onClose,
  onSubmit,
  workflow,
}: EditWorkflowModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync form when workflow changes
  useEffect(() => {
    if (workflow && isOpen) {
      setName(workflow.name || '');
      setDescription(workflow.description || '');
    }
  }, [workflow, isOpen]);

  if (!isOpen || !workflow) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim() || undefined);
      handleClose();
    } catch (error) {
      // Error handled in parent (notification shown there)
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in slide-in-from-bottom-8 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Edit Workflow</h2>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div>
            <label htmlFor="workflow-name" className="block text-sm font-semibold text-gray-700 mb-2">
              Workflow Name
            </label>
            <input
              id="workflow-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q3 Financial Audit 2025"
              className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a brief description..."
              rows={4}
              className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}