'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, Sparkles, CheckCircle2, AlertCircle, KeyRound, ExternalLink } from 'lucide-react';
import api from '@/lib/api/client';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [resetUrl, setResetUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const cleanEmail = email.trim().toLowerCase();

        try {
            // 1. Try backend API
            let responseData: any = null;
            try {
                const res = await api.post('/auth/forgot-password', { email: cleanEmail });
                responseData = res.data;
            } catch (backendErr: any) {
                // 2. Fallback to local Next.js route if backend has network/cold-start delay
                const localRes = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cleanEmail })
                });
                if (localRes.ok) {
                    responseData = await localRes.json();
                } else {
                    const errJson = await localRes.json().catch(() => null);
                    throw new Error(errJson?.error || backendErr?.response?.data?.error || 'Failed to send reset link');
                }
            }

            setIsSubmitted(true);
            if (responseData?.resetUrl) {
                setResetUrl(responseData.resetUrl);
            }
            toast.success('Password reset instructions sent!');
        } catch (err: any) {
            console.error('Forgot password error:', err);
            const msg = err.response?.data?.error || err.message || 'Something went wrong. Please check your email and try again.';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }} />
                </div>

                {/* Floating Glow Accents */}
                <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <Link href="/" className="flex items-center gap-0 mb-16">
                        <img src="/logo.png" alt="V" className="w-8 h-8 brightness-0 invert" />
                        <span className="text-xl font-bold -ml-0.5">iralis</span>
                    </Link>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6 w-fit">
                        <KeyRound className="w-3.5 h-3.5" />
                        Account Security
                    </div>

                    <h1 className="text-5xl font-serif italic leading-tight mb-6">
                        Recover your
                        <span className="text-blue-400"> access securely.</span>
                    </h1>

                    <p className="text-lg text-gray-400 mb-10 max-w-md">
                        Enter your registered email address and we'll help you get right back to automating your growth.
                    </p>

                    <div className="border-t border-gray-800 pt-8 mt-auto">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Encrypted with SHA-256 token verification</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-0 mb-8">
                        <img src="/logo.png" alt="V" className="w-8 h-8" />
                        <span className="text-xl font-bold -ml-0.5">iralis</span>
                    </div>

                    {!isSubmitted ? (
                        <>
                            <div className="mb-8">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-4"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Back to sign in
                                </Link>
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
                                <p className="text-gray-600 text-sm">
                                    No worries! Enter your email address and we will generate a secure password reset link for you.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-800">Request Failed</p>
                                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900 placeholder-gray-400 text-sm"
                                            placeholder="you@company.com"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 px-6 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 focus:ring-4 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group cursor-pointer shadow-sm text-sm"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Generating Reset Link...
                                        </>
                                    ) : (
                                        <>
                                            <span>Send Reset Instructions</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                We have generated a password reset request for{' '}
                                <span className="font-semibold text-gray-900">{email}</span>.
                            </p>

                            {/* Direct Reset Action Card (instant access without waiting for SMTP) */}
                            {resetUrl && (
                                <div className="mb-6 p-4 bg-blue-50/70 border border-blue-100 rounded-xl text-left">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Sparkles className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                                            Instant Reset Link Ready
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-3">
                                        You can continue directly to set your new password:
                                    </p>
                                    <Link
                                        href={resetUrl}
                                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                                    >
                                        <span>Reset Password Now</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            )}

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSubmitted(false);
                                        setResetUrl(null);
                                    }}
                                    className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition-colors"
                                >
                                    Didn't get it? Try another email
                                </button>

                                <Link
                                    href="/login"
                                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 pt-2"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Return to sign in
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <p className="text-xs text-gray-500">
                            Remembered your password?{' '}
                            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
