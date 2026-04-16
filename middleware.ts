import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl
  const session = (req as { auth: { user?: unknown } | null }).auth

  // Always allow auth routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Allow login page
  if (pathname.startsWith('/login')) {
    // If already authenticated, redirect to home
    if (session?.user) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // Protect all other routes
  if (!session?.user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public files
     * - api/auth routes (handled by Auth.js)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
