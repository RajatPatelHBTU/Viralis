'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import api from '@/lib/api/client';
import { toast } from 'sonner';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const queryToken = searchParams.get('token') || '';
    const queryEmail = searchParams.get('email') || '';

    const [token, setToken] = useState(queryToken);
    const [email, setEmail] = useState(queryEmail);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            toast.error('Password too short');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match. Please ensure both fields are identical.');
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);

        const payload = {
            token: token.trim(),
            email: email.trim().toLowerCase(),
            password,
        };

        try {
            // 1. Try backend API
            try {
                await api.post('/auth/reset-password', payload);
            } catch (backendErr: any) {
                // 2. Fallback to local Next.js route
                const localRes = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!localRes.ok) {
                    const errJson = await localRes.json().catch(() => null);
                    throw new Error(errJson?.error || backendErr?.response?.data?.error || 'Failed to reset password');
                }
            }

            setIsSuccess(true);
            toast.success('Password updated successfully!');
        } catch (err: any) {
            console.error('Reset password error:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to reset password. The link may have expired.';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-0 mb-8">
                <img src="/logo.png" alt="V" className="w-8 h-8" />
                <span className="text-xl font-bold -ml-0.5">iralis</span>
            </div>

            {!isSuccess ? (
                <>
                    <div className="mb-8">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-4"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to sign in
                        </Link>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Set New Password</h2>
                        <p className="text-gray-600 text-sm">
                            Create a strong, secure password for your Viralis account.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-red-800">Reset Failed</p>
                                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Token Input (only if not supplied in query) */}
                        {!queryToken && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Reset Verification Token
                                </label>
                                <div className="relative">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900 placeholder-gray-400 text-sm font-mono"
                                        placeholder="Paste verification token..."
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900 placeholder-gray-400 text-sm"
                                    placeholder="Minimum 6 characters"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900 placeholder-gray-400 text-sm"
                                    placeholder="Re-enter new password"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Password match feedback */}
                        {password && confirmPassword && (
                            <div className="text-xs pt-1">
                                {password === confirmPassword ? (
                                    <span className="text-emerald-600 flex items-center gap-1 font-medium">
                                        ✓ Passwords match
                                    </span>
                                ) : (
                                    <span className="text-red-500 font-medium">
                                        ✕ Passwords do not match yet
                                    </span>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 px-6 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 focus:ring-4 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group cursor-pointer shadow-sm text-sm mt-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Updating Password...
                                </>
                            ) : (
                                <>
                                    <span>Reset Password</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </>
            ) : (
                <div className="text-center py-6">
                    <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Complete!</h2>
                    <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                        Your password has been securely updated. You can now use your new password to sign into Viralis.
                    </p>

                    <Link
                        href="/login"
                        className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                    >
                        <span>Sign In Now</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}
        </div>
    );
}

export default function ResetPasswordPage() {
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

                {/* Floating Elements */}
                <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <Link href="/" className="flex items-center gap-0 mb-16">
                        <img src="/logo.png" alt="V" className="w-8 h-8 brightness-0 invert" />
                        <span className="text-xl font-bold -ml-0.5">iralis</span>
                    </Link>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6 w-fit">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Secure Password Update
                    </div>

                    <h1 className="text-5xl font-serif italic leading-tight mb-6">
                        Keep your workspace
                        <span className="text-blue-400"> locked and safe.</span>
                    </h1>

                    <p className="text-lg text-gray-400 mb-10 max-w-md">
                        Once reset, your new credentials take effect immediately across all Viralis AI tools and agent workflows.
                    </p>

                    <div className="border-t border-gray-800 pt-8 mt-auto">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Zero-knowledge hashing with salted bcrypt rounds</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form Container */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
                <Suspense fallback={
                    <div className="flex flex-col items-center justify-center p-12">
                        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-sm text-gray-500 font-medium">Loading security credentials...</p>
                    </div>
                }>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
