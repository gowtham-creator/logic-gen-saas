'use client';

import { ChevronRight, Trash } from '@mynaui/icons-react';
import Image from 'next/image';
import ChatIcon from './icons/ChatIcon';
import DiagramIcon from './icons/DiagramIcon';
import CodeIcon from './icons/CodeIcon';

type Tab = 'chat' | 'diagrams' | 'code';

interface WorkspaceTopNavProps {
  workspaceName: string;
  workspaceId: string;           // ← ADD THIS
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onBack: () => void;
  onClearChat?: () => void;      // ← ADD THIS (optional callback)
}

export default function WorkspaceTopNav({
  workspaceName,
  workspaceId,
  activeTab,
  onTabChange,
  onBack,
  onClearChat,
}: WorkspaceTopNavProps) {
  const getTabIcon = (tabId: Tab, isActive: boolean) => {
    const iconClass = "w-6 h-6";

    switch (tabId) {
      case 'chat':
        return (
          <ChatIcon
            className={iconClass}
            primaryColor={isActive ? "#E5ECFF" : "#E8E8E8"}
            secondaryColor={isActive ? "#3C6CEF" : "#888888"}
          />
        );
      case 'diagrams':
        return (
          <DiagramIcon
            className={iconClass}
            color={isActive ? "#FF643A" : "#888888"}
          />
        );
      case 'code':
        return (
          <CodeIcon
            className={iconClass}
            color={isActive ? "#8F89FF" : "#888888"}
          />
        );
      default:
        return null;
    }
  };

  const getTabColors = (tabId: Tab) => {
    switch (tabId) {
      case 'chat':
        return { text: 'text-blue-600', bg: 'bg-blue-50' };
      case 'diagrams':
        return { text: 'text-[#FF643A]', bg: 'bg-orange-50' };
      case 'code':
        return { text: 'text-[#8F89FF]', bg: 'bg-purple-50' };
      default:
        return { text: 'text-gray-700', bg: '' };
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'CHAT' },
    { id: 'diagrams', label: 'DIAGRAMS' },
    { id: 'code', label: 'CODE' },
  ];

  const handleClearChat = () => {
    if (confirm("Clear all messages in this workflow? This cannot be undone.")) {
      onClearChat?.();
    }
  };

  return (
    <div className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-6">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="hover:opacity-70 transition-opacity"
          title="Back to Dashboard"
        >
          <Image src="/images/lg-logo.png" alt="Home" width={28} height={28} />
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="text-lg font-semibold text-gray-900 truncate max-w-xs">
          {workspaceName}
        </span>
      </div>

      {/* Center: Tabs */}
      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const colors = getTabColors(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                isActive ? '' : ''
              }`}
            >
              <div className={`transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100'}`}>
                {getTabIcon(tab.id, isActive)}
              </div>
              <span
                className={`text-xs font-bold tracking-wider transition-all duration-300 ${
                  isActive
                    ? `${colors.text} ${colors.bg} px-4 py-1.5 rounded-full`
                    : 'text-gray-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Clear Chat Button */}
        {activeTab === 'chat' && (
          <button
            onClick={handleClearChat}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group"
            title="Clear chat history"
          >
            <Trash className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        )}

        {/* Future: Notifications, Help */}
        {/* <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <QuestionCircle className="w-5 h-5 text-gray-600" />
        </button> */}
      </div>
    </div>
  );
}