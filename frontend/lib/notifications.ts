import { Notification, NotificationType } from '@/components/Notification';

class NotificationService {
  private listeners: Array<(notifications: Notification[]) => void> = [];
  private notifications: Notification[] = [];

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }

  show(message: string, type: NotificationType = 'info', duration?: number) {
    const id = Math.random().toString(36).substring(2, 9);
    const notification: Notification = {
      id,
      type,
      message,
      duration: duration !== undefined ? duration : 5000,
    };

    this.notifications.push(notification);
    this.notify();

    return id;
  }

  success(message: string, duration?: number) {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    return this.show(message, 'error', duration || 7000); // Errors stay longer
  }

  info(message: string, duration?: number) {
    return this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number) {
    return this.show(message, 'warning', duration);
  }

  close(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.notify();
  }

  closeAll() {
    this.notifications = [];
    this.notify();
  }
}

export const notificationService = new NotificationService();

