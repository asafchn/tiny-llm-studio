import { NextResponse, type NextRequest } from 'next/server';

// The API writes files and runs commands. The server only listens on 127.0.0.1, but a page on
// another site could still aim the browser at it (CSRF, DNS rebinding), so pin Host and Origin.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (!LOCAL.test(host)) return new NextResponse('forbidden host', { status: 403 });
  const origin = req.headers.get('origin');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (!origin) return new NextResponse('missing origin', { status: 403 });
    try {
      if (!LOCAL.test(new URL(origin).host)) return new NextResponse('forbidden origin', { status: 403 });
    } catch {
      return new NextResponse('bad origin', { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*'] };
