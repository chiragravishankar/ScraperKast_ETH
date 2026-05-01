import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth callback handler.
 *
 * Supabase redirects here after:
 *  - Email confirmation links
 *  - OAuth provider flows (Google, GitHub, etc.)
 *  - Magic link sign-ins
 *
 * The `code` query param is exchanged for a session, then the user is
 * redirected to the `next` param (defaults to /dashboard).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful auth — send to the intended destination
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
  }

  // Something went wrong — send back to login with an error hint
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`
  );
}
