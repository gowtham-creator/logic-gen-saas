'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Redirect to default route (clients)
    router.replace('/admin/super/clients');
  }, [router]);

  // Return consistent content during SSR and initial client render
  // to avoid hydration mismatch
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
