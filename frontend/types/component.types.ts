/**
 * Component prop types
 */

import React from 'react';
import { User } from './user.types';
import { Role } from './role.types';
import { RoleTemplate } from './role.types';
import { ApiKey } from './apiKey.types';
import { Plan } from './plan.types';
import { Client } from './client.types';
import { Notification } from './notification.types';
import { RouteConfig } from './route.types';

export interface UserModalProps {
  user?: Partial<User> | null;
  onClose: () => void;
  onSave: () => void;
}

export interface PasswordChangeModalProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

export interface UserStatusModalProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

export interface RoleModalProps {
  role?: Role | null;
  roles: Role[];
  onClose: () => void;
  onSave: () => void;
}

export interface RoleTemplateModalProps {
  template: RoleTemplate | null;
  onClose: () => void;
  onSave: () => void;
}

export interface ApiKeyModalProps {
  apiKey?: Partial<ApiKey> | null;
  onClose: () => void;
  onSave: (newKey?: ApiKey) => void;
}

export interface PlanModalProps {
  plan?: Plan | null;
  onClose: () => void;
  onSave: () => void;
}

export interface ClientModalProps {
  client?: Client | null;
  plans: Plan[];
  onClose: () => void;
  onSave: () => void;
}

export interface NotificationProps {
  notification: Notification;
  onClose: (id: string) => void;
}

export interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

export interface RouteRendererProps {
  route: RouteConfig;
  fallback?: React.ReactNode;
  [key: string]: any; // Allow additional props to be passed to the component
}

export interface RouteGuardProps {
  children: React.ReactNode;
  resource: string;
  action: string;
  elementId?: string;
  fallback?: React.ReactNode;
}

export interface PermissionDeniedProps {
  message?: string;
  resource?: string;
  action?: string;
  showBackButton?: boolean;
}

