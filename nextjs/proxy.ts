import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// /privacy must stay reachable without login — required for app store review
// and to be a valid privacy policy link (can't gate a privacy policy behind auth).
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/privacy'];

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');

async function verifyToken(token: string) {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/api/auth')) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();

  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : undefined;
  const token = req.cookies.get('token')?.value ?? bearerToken;
  const valid = token ? await verifyToken(token) : false;

  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
