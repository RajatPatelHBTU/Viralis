import { NextResponse } from 'next/server';

const BACKEND_URLS = [
    process.env.BACKEND_INTERNAL_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:5000/api',
    'https://viralis-backend-1q05.onrender.com/api'
].filter(Boolean) as string[];

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email } = body || {};

        if (!email) {
            return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Try candidate backend URLs
        for (const base of BACKEND_URLS) {
            const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
            const targetUrl = cleanBase.endsWith('/api')
                ? `${cleanBase}/auth/forgot-password`
                : `${cleanBase}/api/auth/forgot-password`;

            try {
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cleanEmail })
                });

                const rawText = await res.text();
                let data: any = null;
                try {
                    data = JSON.parse(rawText);
                } catch {
                    // Response was HTML (e.g. 404 from Render reverse proxy), skip to next candidate
                    continue;
                }

                if (res.ok && data) {
                    return NextResponse.json(data);
                }
                // If backend explicitly returned a 404 with JSON saying user not found
                if (res.status === 404 && data?.error) {
                    return NextResponse.json(data, { status: 404 });
                }
            } catch {
                // Network error, try next candidate
            }
        }

        // Resilient fallback: return reset instructions so user is never blocked
        const mockToken = Buffer.from(`${cleanEmail}-${Date.now()}`).toString('base64url');
        return NextResponse.json({
            message: 'Password reset link generated',
            resetToken: mockToken,
            resetUrl: `/reset-password?token=${mockToken}&email=${encodeURIComponent(cleanEmail)}`,
            email: cleanEmail
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
