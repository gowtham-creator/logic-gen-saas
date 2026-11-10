'use client';

import { HardDrive } from 'lucide-react';
import GlobalStorage from '@/components/GlobalStorage';

export default function StoragePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#5B5FC7]">Storage Management</h2>
          <p className="text-sm text-gray-600 mt-1">Configure the default storage location for all clients.</p>
        </div>
      </div>

      {/* Storage Component */}
      <GlobalStorage />
    </div>
  );
}

