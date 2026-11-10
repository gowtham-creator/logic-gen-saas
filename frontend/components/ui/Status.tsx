import React from 'react';
import { Check, Minus, X } from 'lucide-react';

export type StatusType = 'active' | 'inactive' | 'expired';

interface StatusProps {
  status: StatusType;
  className?: string;
}

const statusConfig = {
  active: {
    label: 'Active',
    icon: Check,
    containerClass: 'border-[#007B0B] bg-[#ECFDF3]',
    iconClass: 'text-[#007B0B]',
    textClass: 'text-[#007B0B]',
  },
  inactive: {
    label: 'Inactive',
    icon: Minus,
    containerClass: 'border-gray-400 bg-gray-50',
    iconClass: 'text-gray-500',
    textClass: 'text-gray-700',
  },
  expired: {
    label: 'Expire',
    icon: X,
    containerClass: 'border-red-500 bg-red-50',
    iconClass: 'text-red-500',
    textClass: 'text-red-700',
  },
};

export const Status: React.FC<StatusProps> = ({ status, className = '' }) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${config.containerClass} ${className}`}
    >
      <div className={`flex items-center justify-center w-4 h-4 rounded-full border ${config.containerClass} ${config.iconClass} bg-white`}>
        <Icon className={`w-2.5 h-2.5 ${config.textClass}`} strokeWidth={3} />
      </div>
      <span className={`text-sm font-medium ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
};

export default Status;
