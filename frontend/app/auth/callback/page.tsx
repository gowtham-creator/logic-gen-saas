'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error from SSO provider or backend
        const errorParam = searchParams.get('error');
        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          setStatus('error');
          return;
        }

        const accessToken = searchParams.get('accessToken');
        const refreshToken = searchParams.get('refreshToken');

        if (!accessToken || !refreshToken) {
          setError('Missing authentication tokens. Please try logging in again.');
          setStatus('error');
          return;
        }

        // Store tokens in localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        // Fetch user info to get full user object
        try {
          const baseURL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
          const response = await fetch(`${baseURL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const user = data.data;
              localStorage.setItem('user', JSON.stringify(user));
              
              // Set flags based on user properties
              if (user.isSuperAdmin) {
                localStorage.setItem('isSuperAdmin', 'true');
              }
              if (user.isDeveloper) {
                localStorage.setItem('isDeveloper', 'true');
              }

              // Trigger auth state change event
              window.dispatchEvent(new Event('auth-state-changed'));

              setStatus('success');
              
              // Redirect to dashboard after a brief delay
              setTimeout(() => {
                router.push('/dashboard');
              }, 1000);
            } else {
              throw new Error('Failed to fetch user information');
            }
          } else {
            throw new Error('Failed to fetch user information');
          }
        } catch (err: any) {
          console.error('Error fetching user info:', err);
          // Even if user info fetch fails, we have tokens, so proceed
          setStatus('success');
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Failed to complete authentication. Please try logging in again.');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 via-primary-400 to-secondary-500">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
          <Loader2 className="h-12 w-12 text-primary-600 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Completing Sign In</h2>
          <p className="text-gray-600">Please wait while we finish setting up your session...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 via-primary-400 to-secondary-500">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="btn-primary w-full"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 via-primary-400 to-secondary-500">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Successful</h2>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    // @ts-ignore - React 19 type compatibility issue with Suspense
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 via-primary-400 to-secondary-500">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
            <Loader2 className="h-12 w-12 text-primary-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading</h2>
            <p className="text-gray-600">Please wait...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

