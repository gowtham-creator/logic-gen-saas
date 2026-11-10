'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeveloperDashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Redirect to default route (overview)
    router.replace('/developer/dashboard/overview');
  }, [router]);

  // Render a consistent placeholder on both server and client to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-gray-500">Redirecting...</div>
    </div>
  );
}
