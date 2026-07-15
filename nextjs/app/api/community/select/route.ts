import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { canAccessCommunity, setActiveCommunityCookie } from '@/lib/community';
import { err, unauthorized, forbidden } from '@/lib/api';

const schema = z.object({ communityId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const allowed = await canAccessCommunity(session, parsed.data.communityId);
  if (!allowed) return forbidden();

  const res = NextResponse.json({ success: true });
  const cookieHeader = setActiveCommunityCookie(parsed.data.communityId);
  res.headers.set('Set-Cookie', cookieHeader['Set-Cookie']);
  return res;
}
