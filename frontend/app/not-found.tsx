'use client';

import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { ROUTES } from '@/constants/routes';

export default function NotFound() {
  const router = useRouter();

  const handleGoHome = () => {
    if (isAuthenticated()) {
      router.push(ROUTES.DASHBOARD);
    } else {
      router.push(ROUTES.LOGIN);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-9xl font-bold text-primary-600 mb-4 leading-none">404</h1>
        <h2 className="text-3xl font-semibold text-gray-900 mb-3">Page Not Found</h2>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleGoHome}
            className="btn-primary"
          >
            Go to {isAuthenticated() ? 'Dashboard' : 'Login'}
          </button>
          <button
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
