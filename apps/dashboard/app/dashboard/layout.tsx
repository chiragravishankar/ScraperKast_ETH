import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from './components/DashboardShell';
import './styles/dashboard.css';

/**
 * Dashboard layout — SERVER component.
 *
 * Validates the session server-side on every request (supabase.auth.getUser()
 * hits the Supabase server to verify the JWT, not just the cookie).
 * Redirects to /login if the session is missing or expired.
 *
 * The actual UI (sidebar, topbar, providers) lives in DashboardShell, which is
 * a client component that accepts the verified user as a prop.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
