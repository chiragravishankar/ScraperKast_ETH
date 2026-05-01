import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AuditPayload } from '@/app/api/audit/run/route';
import AuditTool from './components/AuditTool';

export const metadata = {
  title: 'Scraper Audit — ScraperKast',
};

export default async function AuditPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard/audit');

  // Fetch the 5 most recent completed audits for this user
  const { data: rows } = await supabase
    .from('audits')
    .select('id, target_url, vulnerability_score, status, results')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(5);

  const recentAudits: AuditPayload[] = (rows ?? []).map(r => ({
    id:                 r.id as string,
    targetUrl:          r.target_url as string,
    vulnerabilityScore: (r.vulnerability_score as number) ?? 0,
    status:             'complete' as const,
    results:            r.results as AuditPayload['results'],
  }));

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Scraper Audit Tool</h1>
        <p className="text-sm text-ink-3 mt-1">
          Discover exactly how vulnerable your site is to AI scrapers — before they find out.
        </p>
      </div>

      <AuditTool recentAudits={recentAudits} />
    </div>
  );
}
