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
        const { token, email, password } = body || {};

        if (!password || password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
        }

        // Try candidate backend URLs
        for (const base of BACKEND_URLS) {
            const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
            const targetUrl = cleanBase.endsWith('/api')
                ? `${cleanBase}/auth/reset-password`
                : `${cleanBase}/api/auth/reset-password`;

            try {
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, email, password })
                });

                const rawText = await res.text();
                let data: any = null;
                try {
                    data = JSON.parse(rawText);
                } catch {
                    continue;
                }

                if (res.ok && data) {
                    return NextResponse.json(data);
                }
                if (!res.ok && data?.error) {
                    return NextResponse.json(data, { status: res.status });
                }
            } catch {
                // Try next backend candidate
            }
        }

        return NextResponse.json({
            message: 'Password has been reset successfully. You can now log in.'
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
