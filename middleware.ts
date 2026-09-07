// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Look for the custom cookie we created in auth.ts
  const session = request.cookies.get('custom_admin_session')?.value;

  // Protect admin routes: If no cookie and trying to access dashboard/etc
  if (path.startsWith('/admin') && path !== '/admin' && !session) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Redirect logged-in users away from the login page
  if (path === '/admin' && session) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};