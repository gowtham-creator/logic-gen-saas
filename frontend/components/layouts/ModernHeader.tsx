'use client';

import { Bell, QuestionCircle } from '@mynaui/icons-react';
import ProfileDropdown from '../ProfileDropdown';

export default function ModernHeader() {
  return (
    <header className="h-[80px] bg-white border-b border-gray-100 flex items-center justify-end px-8">
      {/* Right side - Actions */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-lg transition-all duration-200">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>

        {/* Help Icon */}
        <button className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-lg transition-all duration-200">
          <QuestionCircle className="w-5 h-5 text-gray-600" />
        </button>

        {/* Profile Dropdown */}
        <ProfileDropdown />
      </div>
    </header>
  );
}
