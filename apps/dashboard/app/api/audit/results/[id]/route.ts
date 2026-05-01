import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AuditPayload } from '../../run/route';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing audit ID' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('audits')
    .select('id, target_url, vulnerability_score, status, results, created_at, completed_at')
    .eq('id', id)
    .eq('user_id', user.id)  // RLS enforced + explicit ownership check
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  const payload: AuditPayload = {
    id:                 data.id as string,
    targetUrl:          data.target_url as string,
    vulnerabilityScore: (data.vulnerability_score as number) ?? 0,
    status:             (data.status as 'complete' | 'failed'),
    results:            data.results as AuditPayload['results'],
  };

  return NextResponse.json(payload);
}
