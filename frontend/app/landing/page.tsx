'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

/**
 * Landing page that redirects all authenticated users to the dashboard
 * The dashboard is the core app for all user types (admin, super admin, developer, normal user)
 */
export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || redirected) return;

    // Check authentication first
    if (!isAuthenticated()) {
      router.replace('/login');
      setRedirected(true);
      return;
    }

    // All authenticated users go to the dashboard (core app)
    router.replace('/dashboard');
    setRedirected(true);
  }, [mounted, router, redirected]);

  // Show loading state during redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50/30">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

