import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Paths that do not require login
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/portal');

  // Check auth session cookie
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  // If user is not logged in and path is NOT public, redirect to login
  if (!sessionToken && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is logged in, inspect status
  if (sessionToken) {
    try {
      const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
      if (secret) {
        const token = await getToken({
          req: request,
          secret,
          secureCookie: request.url.startsWith('https://'),
        });

        if (token) {
          const isPending = token.status === 'pending';
          const isApproved = token.status === 'approved';

          // User pending dilarang mengakses halaman data, wajib ke /pending
          if (isPending && pathname !== '/pending' && !pathname.startsWith('/api/auth') && !pathname.startsWith('/auth')) {
            const url = request.nextUrl.clone();
            url.pathname = '/pending';
            return NextResponse.redirect(url);
          }

          // User approved dilarang mengakses /login atau /pending, arahkan ke /
          if (isApproved && (pathname.startsWith('/login') || pathname === '/pending')) {
            return NextResponse.redirect(new URL('/', request.url));
          }
        }
      }
    } catch {
      // Abaikan error getToken dan biarkan AuthProvider client-side menangani
    }

    if (pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - any files with extensions (e.g. .svg, .png)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
