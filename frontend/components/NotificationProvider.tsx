'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { notificationService } from '@/lib/notifications';
import NotificationContainer, { Notification } from './Notification';

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((newNotifications) => {
      setNotifications(newNotifications);
    });

    return unsubscribe;
  }, []);

  const handleClose = (id: string) => {
    notificationService.close(id);
  };

  return (
    <>
      {children}
      <NotificationContainer notifications={notifications} onClose={handleClose} />
    </>
  );
}

