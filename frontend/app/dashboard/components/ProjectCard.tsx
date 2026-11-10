'use client';

import { Dots } from '@mynaui/icons-react';
import { useState } from 'react';

interface ProjectCardProps {
  title: string;
  date: string;
  onOpen: () => void;
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ProjectCard({ title, date, onOpen, onViewDetails, onEdit, onDelete }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleAction = (action: () => void) => {
    setShowMenu(false);
    action();
  };

  return (
    <div className="bg-white rounded-2xl p-5 transition-all duration-200 relative group cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0" onClick={onOpen}>
          <h3 className="text-base font-semibold text-gray-900 mb-1.5 truncate">{title}</h3>
          <p className="text-sm text-gray-500">{date}</p>
        </div>

        {/* Menu Button */}
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <Dots className="w-5 h-5 text-gray-600" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => handleAction(onViewDetails)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleAction(onEdit)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                <hr className="my-2 border-gray-100" />
                <button
                  onClick={() => handleAction(onDelete)}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
