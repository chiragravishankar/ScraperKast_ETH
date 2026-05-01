'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, User, Mail, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ── Google logo (official four-colour "G") ────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

type SignupState = 'idle' | 'loading' | 'confirm_email' | 'error';

export default function SignupPage() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [state,         setState]         = useState<SignupState>('idle');
  const [error,         setError]         = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setState('error');
      return;
    }

    setState('loading');
    setError('');

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setState('error');
      return;
    }

    // Email confirmation is disabled — session returned immediately.
    if (data.session) {
      router.refresh();
      router.push('/dashboard');
      return;
    }

    // Email confirmation required — show "check your inbox" screen.
    setState('confirm_email');
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    setError('');
    setState('idle');

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setState('error');
      setGoogleLoading(false);
    }
    // On success the browser navigates to Google — keep spinner until redirect.
  }

  // ── Confirm-email success screen ─────────────────────────────────────────────
  if (state === 'confirm_email') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-ink tracking-tight">ScraperKast</span>
          </div>

          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-ink">Check your inbox</h1>
            <p className="text-sm text-ink-3 mt-2 leading-relaxed">
              We sent a confirmation link to{' '}
              <span className="font-semibold text-ink">{email}</span>.
              Click the link to activate your account.
            </p>
            <p className="text-xs text-ink-3 mt-4">
              Already confirmed?{' '}
              <Link href="/login" className="text-accent font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo mark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-ink tracking-tight">ScraperKast</span>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h1 className="text-xl font-bold text-ink text-center">Create your account</h1>
          <p className="text-sm text-ink-3 text-center mt-1">
            Start monetising your data for AI
          </p>

          <div className="mt-6 space-y-3">

            {/* ── Google OAuth ──────────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => { void handleGoogleSignup(); }}
              disabled={googleLoading || state === 'loading'}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-edge text-ink rounded-xl font-semibold text-sm hover:bg-canvas hover:border-ink-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-ink-3" />
              ) : (
                <GoogleIcon />
              )}
              Sign up with Google
            </button>

          </div>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mt-5">
            <div className="h-px flex-1 bg-edge" />
            <span className="text-xs text-ink-3 font-medium whitespace-nowrap">
              Or sign up with email
            </span>
            <div className="h-px flex-1 bg-edge" />
          </div>

          {/* ── Email / password form ──────────────────────────────────────── */}
          <form onSubmit={e => { void handleSubmit(e); }} className="mt-4 space-y-4">

            {/* Error banner */}
            {state === 'error' && error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Full name */}
            <div>
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                Full name
              </label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Jane Smith"
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                Email address
              </label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  className="input pl-9"
                />
              </div>
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-amber-600 mt-1">
                  {8 - password.length} more character{8 - password.length === 1 ? '' : 's'} needed
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={state === 'loading'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {state === 'loading' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="text-sm text-center text-ink-3 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-accent font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ink-3 mt-6">
          ScraperKast — monetise your data for AI
        </p>
      </div>
    </div>
  );
}
