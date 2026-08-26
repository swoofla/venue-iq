import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { createPageUrl } from '../utils';

// Auth errors arrive in three shapes: a FastAPI validation array, a string
// detail, or a message that may not be a string at all. Resolving them in one
// place keeps every handler below rendering readable text instead of
// "[object Object]".
function resolveErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  const detailMsg = Array.isArray(detail) ? detail[0]?.msg : (typeof detail === 'string' ? detail : null);
  const raw = err?.message;
  const rawMsg = typeof raw === 'string' ? raw : (raw ? JSON.stringify(raw) : null);
  return detailMsg || rawMsg || fallback;
}

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [step, setStep] = useState('form');
  const [otpCode, setOtpCode] = useState('');
  const [resendNote, setResendNote] = useState(null);

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setError('No invitation token provided');
        setLoading(false);
        return;
      }

      try {
        const result = await base44.functions.invoke('validateUserInvite', { token });
        if (!result.data?.success) {
          navigate(createPageUrl('Login'));
          return;
        }
        const foundInvite = result.data.invite;
        setInvite(foundInvite);
        setFormData(prev => ({ ...prev, email: foundInvite.email, name: foundInvite.name || '' }));
      } catch (err) {
        console.error('Load invite error:', err);
        setError('Failed to load invitation details');
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      await base44.auth.register({ email: formData.email, password: formData.password });
      setStep('otp');
    } catch (err) {
      console.error('Registration error:', err);
      
      const msgText = typeof err?.message === 'string' ? err.message : JSON.stringify(err?.message ?? '');
      if (msgText.includes('already registered') || msgText.includes('already exists')) {
        setError('An account with this email already exists. Please log in instead.');
      } else {
        console.error('[register] failure:', err?.response?.data || err);
        setError(resolveErrorMessage(err, 'Failed to create account. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);

    if (!otpCode.trim()) {
      setError('Enter the code from your email');
      return;
    }

    setSubmitting(true);

    try {
      await base44.auth.verifyOtp({ email: formData.email, otpCode: otpCode.trim() });
      await base44.auth.loginViaEmailPassword(formData.email, formData.password);
      // Hard navigation on purpose: the auth context must re-read the now
      // authenticated user, which a client-side navigate() would not trigger.
      window.location.href = `${window.location.origin}${createPageUrl('Invite')}?token=${token}`;
    } catch (err) {
      console.error('[verifyOtp] failure:', err?.response?.data || err);
      setError(resolveErrorMessage(err, 'Could not verify that code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendNote(null);

    try {
      await base44.auth.resendOtp(formData.email);
      setResendNote('A new code is on its way.');
    } catch (err) {
      console.error('[resendOtp] failure:', err?.response?.data || err);
      const status = err?.response?.status;
      const text = resolveErrorMessage(err, '');
      if (status === 429 || /429|rate limit/i.test(String(text))) {
        setResendNote('Please wait a moment before requesting another code.');
      } else {
        setError(resolveErrorMessage(err, 'Could not resend the code. Please try again.'));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {formData.email}. Enter it below to finish setting up your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otpCode">Verification Code</Label>
                <Input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {resendNote && (
                <p className="text-sm text-stone-500">{resendNote}</p>
              )}

              <Button
                type="submit"
                className="w-full rounded-full bg-black hover:bg-stone-800"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify and continue'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-stone-600 hover:underline"
              >
                Resend code
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Create Your Account</CardTitle>
          <CardDescription>
            Set up your account to access {invite?.venue_id ? 'your venue dashboard' : 'the platform'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Jane Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-stone-50"
              />
              <p className="text-xs text-stone-500">
                This email was used for your invitation and cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full rounded-full bg-black hover:bg-stone-800"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-600">
              Already have an account?{' '}
              <button
                onClick={() => base44.auth.redirectToLogin(`${window.location.origin}${createPageUrl('Invite')}?token=${token}`)}
                className="text-black font-medium hover:underline"
              >
                Log in
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}