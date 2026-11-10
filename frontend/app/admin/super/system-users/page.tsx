'use client';

import { Users } from 'lucide-react';
import SystemUsers from '@/components/SystemUsers';

export default function SystemUsersPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <h1 className="text-3xl font-medium text-[#5B5FC7]">System Users</h1>
            </div>
            <p className="text-[16px] text-gray-500 mt-1">Manage Developer and Superadmin roles.</p>
          </div>
        </div>
      </div>

      <SystemUsers />
    </div>
  );
}

