import { NextResponse } from 'next/server';
import { clearTokenCookie } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const cookieHeader = clearTokenCookie();
  res.headers.set('Set-Cookie', cookieHeader['Set-Cookie']);
  return res;
}
