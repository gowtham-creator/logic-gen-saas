'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import type { Notification, NotificationType, NotificationProps, NotificationContainerProps } from '@/types';

export type { Notification, NotificationType };

function NotificationItem({ notification, onClose }: NotificationProps) {
  useEffect(() => {
    if (notification.duration !== 0) {
      const timer = setTimeout(() => {
        onClose(notification.id);
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, onClose]);

  const getIcon = () => {
    const iconClass = 'h-5 w-5 flex-shrink-0';
    switch (notification.type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-600`} />;
      case 'error':
        return <XCircle className={`${iconClass} text-red-600`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-600`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
      default:
        return null;
    }
  };

  const getStyles = () => {
    const baseStyles = 'flex items-start space-x-3 p-4 rounded-xl shadow-lg min-w-[300px] max-w-[500px] animate-slideUp border-l-4';
    const typeStyles = {
      success: 'bg-gradient-to-r from-green-50 to-green-100/50 border-green-500 text-green-900',
      error: 'bg-gradient-to-r from-red-50 to-red-100/50 border-red-500 text-red-900',
      info: 'bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-500 text-blue-900',
      warning: 'bg-gradient-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 text-yellow-900',
    };
    return `${baseStyles} ${typeStyles[notification.type]}`;
  };

  return (
    <div className={getStyles()}>
      {getIcon()}
      <div className="flex-1 text-sm font-medium leading-relaxed">
        {notification.message}
      </div>
      <button
        onClick={() => onClose(notification.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition-colors duration-200 opacity-70 hover:opacity-100"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}


export default function NotificationContainer({ notifications, onClose }: NotificationContainerProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={onClose}
        />
      ))}
    </div>
  );
}
