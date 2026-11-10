'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, ArrowLeft, AlertTriangle } from 'lucide-react';
import { isAuthenticated, getStoredUser } from '@/lib/auth';
import { apiClient } from '@/lib/api';

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [user, setUser] = useState<any>(null);
  const [logged, setLogged] = useState(false);

  const attemptedPath = searchParams.get('path') || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const resource = searchParams.get('resource') || 'this resource';

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const storedUser = getStoredUser();
      setUser(storedUser);
    }
  }, []);

  useEffect(() => {
    if (mounted && !logged) {
      logUnauthorizedAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const logUnauthorizedAccess = async () => {
    if (logged) return;
    setLogged(true);
    
    try {
      await apiClient.post('/api/audit-logs/unauthorized-access', {
        attemptedPath: attemptedPath,
        resource: resource,
      });
    } catch (error) {
      // Silently fail - we don't want to show errors to the user
      console.error('Failed to log unauthorized access:', error);
    }
  };

  useEffect(() => {
    if (!mounted) return;

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleGoBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mounted]);

  const handleGoBack = () => {
    // Try to go back in history, or redirect to a safe default
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      // Fallback to dashboard or login
      if (isAuthenticated()) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-red-50/30 p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-xl shadow-lg border border-red-200 p-8 sm:p-12">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-100 rounded-full">
                <ShieldAlert className="h-12 w-12 text-red-600" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Access Denied
            </h1>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    Unauthorized Access Attempt
                  </p>
                  <p className="text-sm text-yellow-700">
                    You don't have permission to access <span className="font-mono font-semibold">{resource}</span>.
                    This attempt has been logged for security purposes.
                  </p>
                </div>
              </div>
            </div>

            {user && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">User:</span> {user.email}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Attempted Path:</span>{' '}
                  <span className="font-mono">{attemptedPath}</span>
                </p>
              </div>
            )}

            <p className="text-gray-600 mb-6">
              You will be redirected back in <span className="font-semibold text-red-600">{countdown}</span> seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleGoBack}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center space-x-2"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Go Back Now</span>
              </button>
              
              {isAuthenticated() && (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    // @ts-ignore - React 19 type compatibility issue with Suspense
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-red-50/30 p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-xl shadow-lg border border-red-200 p-8 sm:p-12">
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-red-100 rounded-full">
                    <ShieldAlert className="h-12 w-12 text-red-600" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Loading...</h1>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <UnauthorizedContent />
    </Suspense>
  );
}

