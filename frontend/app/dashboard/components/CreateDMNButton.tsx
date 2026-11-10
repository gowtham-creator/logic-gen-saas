'use client';

import { Plus } from '@mynaui/icons-react';

interface CreateDMNButtonProps {
  onClick?: () => void;
  isCollapsed?: boolean;
}

export default function CreateDMNButton({ onClick, isCollapsed = false }: CreateDMNButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`mb-6 bg-gray-900 hover:bg-gray-800 text-white rounded-full py-3 mx-auto flex items-center justify-center gap-2 transition-all duration-200 font-medium text-xs ${
        isCollapsed ? 'mx-3' : 'mx-4 px-4'
      }`}
      title={isCollapsed ? 'Create a Workspace' : ''}
    >
      <Plus className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && <span className="whitespace-nowrap">Create a Workspace</span>}
    </button>
  );
}
