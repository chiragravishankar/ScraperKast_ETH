import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js middleware — runs on every request before the page renders.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session token (keeps cookies up-to-date)
 *  2. Protect /dashboard/* — redirect unauthenticated users to /login
 *  3. Redirect authenticated users away from /login and /signup
 *
 * IMPORTANT: Do not add any logic between createServerClient() and
 * supabase.auth.getUser(). The cookie-setting side effects must complete
 * before returning supabaseResponse.
 */
export async function middleware(request: NextRequest) {
  // Start with a plain pass-through response that we'll mutate as cookies change.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward cookie mutations to both the request and the response so
          // subsequent server components see the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate the user server-side (getUser() hits Supabase, not just the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Route guards ─────────────────────────────────────────────────────────────

  // Unauthenticated → redirect to /login, preserving the intended destination
  if (!user && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated → redirect away from auth pages to dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Return the (possibly mutated) response so refreshed cookies are sent.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     *  - _next/static (static files)
     *  - _next/image (image optimisation)
     *  - favicon.ico
     *  - public assets (svg, png, jpg, …)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
