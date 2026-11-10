'use client';

import { useState, useRef } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import GlobalThemeManagement from '@/components/GlobalThemeManagement';

export default function ThemePage() {
  const resetRef = useRef<(() => Promise<void>) | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetClick = async () => {
    if (resetRef.current) {
      setIsResetting(true);
      await resetRef.current();
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div>
            <h2 className="text-[16px] sm:text-3xl font-medium text-[#4B4CB2]">Global Theme Management</h2>
            <p className="text-sm text-gray-600 mt-1">Default theme applied to all clients </p>
          </div>
        </div>
        <button
          onClick={handleResetClick}
          disabled={isResetting}
          className="btn-secondary flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset to Default</span>
        </button>
      </div>

      <GlobalThemeManagement resetRef={resetRef} />
    </div>
  );
}

