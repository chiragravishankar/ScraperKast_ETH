import { NextResponse } from 'next/server';
import { RULE_TEMPLATES } from '@/lib/pricingStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ templates: RULE_TEMPLATES });
}
