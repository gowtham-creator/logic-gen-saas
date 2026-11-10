'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { logout } from '@/lib/auth';

interface UserProfileProps {
  name: string;
  status?: string;
  avatar?: string;
  isCollapsed?: boolean;
}

export default function UserProfile({ name, status = 'Free', avatar, isCollapsed = false }: UserProfileProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force logout even if API call fails
      router.push('/login');
    }
  };

  return (
    <div className={`absolute bottom-6 ${isCollapsed ? 'left-2 right-2' : 'left-4 right-4'}`}>
      <div className="relative">
        <div
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer`}
          title={isCollapsed ? name : ''}
          onClick={() => setShowMenu(!showMenu)}
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shrink-0">
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-white font-semibold text-sm">
                {name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            )}
          </div>

          {/* User Info */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
              <p className="text-xs text-gray-500">{status}</p>
            </div>
          )}
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />

            {/* Menu */}
            <div className={`absolute ${isCollapsed ? 'left-full ml-2' : 'bottom-full mb-2'} ${isCollapsed ? 'left-0' : 'left-0 right-0'} bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20 min-w-[200px]`}>
              <button
                onClick={() => {
                  setShowMenu(false);
                  router.push('/settings');
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <div className="h-px bg-gray-200 my-1" />
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
