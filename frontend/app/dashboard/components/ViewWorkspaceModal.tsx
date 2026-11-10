// components/workflow/ViewWorkflowModal.tsx
'use client';

import { X, Calendar, User, FileText, CheckCircle } from '@mynaui/icons-react';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isActive: boolean;
  createdUser?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface ViewWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: Workflow | null;
}

export default function ViewWorkflowModal({ isOpen, onClose, workflow }: ViewWorkflowModalProps) {
  if (!isOpen || !workflow) return null;

  const creatorName = workflow.createdUser
    ? `${workflow.createdUser.firstName} ${workflow.createdUser.lastName}`
    : 'Unknown User';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Workflow Details</h2>
              <p className="text-sm text-gray-500">ID: {workflow.id.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6">
          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
              <FileText className="w-4 h-4" />
              Workflow Name
            </label>
            <p className="text-lg font-semibold text-gray-900">{workflow.name}</p>
          </div>

          {/* Description */}
          {workflow.description ? (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                Description
              </label>
              <p className="text-base text-gray-700 leading-relaxed bg-gray-50 px-4 py-3 rounded-xl">
                {workflow.description}
              </p>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-600">Description</label>
              <p className="text-base text-gray-400 italic">No description provided</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            {/* Created By */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                <User className="w-4 h-4" />
                Created By
              </label>
              <p className="text-base font-medium text-gray-900">{creatorName}</p>
            </div>

            {/* Status */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                <CheckCircle className="w-4 h-4" />
                Status
              </label>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  workflow.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${workflow.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                {workflow.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className="pt-4 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-3">
              <Calendar className="w-4 h-4" />
              Created
            </label>
            <div className="space-y-1">
              <p className="text-base font-medium text-gray-900">{workflow.createdAt}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-7 py-5 border-t border-gray-100 bg-gray-50/70 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}