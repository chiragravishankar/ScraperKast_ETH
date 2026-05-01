'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // router.refresh() ensures server components re-run with the cleared session
    router.refresh();
    router.push('/login');
  }

  return (
    <button
      onClick={() => { void signOut(); }}
      disabled={loading}
      title="Sign out"
      className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-accent transition-colors px-2 py-1.5 rounded-lg hover:bg-accent-muted disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <LogOut  className="w-3.5 h-3.5" />
      }
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
