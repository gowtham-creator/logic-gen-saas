'use client';

import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { ROUTES } from '@/constants/routes';
import { MESSAGES } from '@/constants/messages';
import { PermissionDeniedProps } from '@/types';

export default function PermissionDenied({
  message,
  resource,
  action,
  showBackButton = true,
}: PermissionDeniedProps) {
  const router = useRouter();

  const defaultMessage = message || MESSAGES.ERROR.PERMISSION_DENIED;
  const detailMessage = resource && action
    ? `You don't have permission to ${action} ${resource}.`
    : null;

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 bg-red-50 rounded-xl border border-red-200">
      <div className="text-center max-w-lg">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-semibold text-red-900 mb-2">Access Denied</h2>
        <p className="text-base text-red-800 mb-2 leading-relaxed">
          {defaultMessage}
        </p>
        {detailMessage && (
          <p className="text-sm text-red-700 mb-6 leading-relaxed">
            {detailMessage}
          </p>
        )}
        {showBackButton && (
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                if (isAuthenticated()) {
                  router.push(ROUTES.DASHBOARD);
                } else {
                  router.push(ROUTES.LOGIN);
                }
              }}
              className="btn-danger"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
