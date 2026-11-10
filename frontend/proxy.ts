import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy to handle route protection and redirects
 * This runs on the edge and can check authentication/permissions
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login', 
    '/reset-password',
    '/unauthorized',
    '/'
  ];
  
  // Check if route is public
  if (publicRoutes.includes(pathname) || 
      pathname.startsWith('/login') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/unauthorized')) {
    return NextResponse.next();
  }

  // For protected routes, we'll let the client-side handle authentication
  // since we need to check JWT tokens and permissions
  // This proxy can be extended for server-side checks if needed
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

