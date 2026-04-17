import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
function randKey(prefix: string) {
  return `${prefix}_${Array.from({ length: 24 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')}`;
}

export async function POST() {
  return NextResponse.json({ key: randKey('sk_live_scraperkast'), createdAt: new Date().toISOString() });
}
