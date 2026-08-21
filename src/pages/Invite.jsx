import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, XCircle, Building2, AlertCircle } from 'lucide-react';
import { createPageUrl } from '../utils';

// Turns anything thrown by the SDK into something a person can read.
// The backend's validation errors arrive as an object, so reading err.message
// straight into JSX is what produced "[object Object]" on the Register page.
function readableError(err) {
  const detailMsg = err?.response?.data?.detail?.[0]?.msg;
  if (typeof detailMsg === 'string' && detailMsg) return detailMsg;

  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;

  if (typeof err?.message === 'string' && err.message) return err.message;

  try {
    return JSON.stringify(err);
  } catch (_e) {
    return 'An unexpected error occurred.';
  }
}

export default function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(null);

  useEffect(() => {
    async function validateInvite() {
      if (!token) {
        setError('No invitation token provided');
        setLoading(false);
        return;
      }

      try {
        const result = await base44.functions.invoke('validateUserInvite', { token });
        if (!result.data?.success) {
          setError(result.data?.error || 'Invalid invitation link');
          setLoading(false);
          return;
        }
        setInvite(result.data.invite);
        setVenue({ name: result.data.invite.venue_name });

        // Is anyone signed in? On a public page this throws when not logged in,
        // so any failure here simply means "treat them as anonymous".
        try {
          const me = await base44.auth.me();
          setCurrentUser(me || null);
        } catch (authErr) {
          console.error('Invite auth check (treating as anonymous):', authErr);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Invite validation error:', err);
        setError('Failed to validate invitation');
      } finally {
        setLoading(false);
      }
    }

    validateInvite();
  }, [token]);

  const handleCreateAccount = () => {
    navigate(createPageUrl('Register') + `?token=${token}`);
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleAccept = async () => {
    setAcceptError(null);
    setAccepting(true);
    try {
      const result = await base44.functions.invoke('acceptUserInvite', {
        token: token,
        name: currentUser?.full_name || invite?.name || ''
      });

      if (!result.data?.success) {
        throw new Error(result.data?.error || 'Failed to accept invitation');
      }

      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      console.error('Accept invite error:', err);
      setAcceptError(readableError(err));
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-stone-400 mx-auto mb-4" />
          <p className="text-stone-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const normalize = (value) => (value || '').trim().toLowerCase();
  const inviteEmail = normalize(invite?.email);
  const signedInEmail = normalize(currentUser?.email);
  const isSignedIn = Boolean(signedInEmail);
  const emailMatches = isSignedIn && inviteEmail === signedInEmail;

  // Signed in with a different account. Accepting would attach the wrong
  // person to the venue, so this branch never calls acceptUserInvite.
  if (isSignedIn && !emailMatches) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <CardTitle>Wrong account</CardTitle>
            <CardDescription>
              This invitation is for <strong>{invite?.email}</strong>, but you're signed in as{' '}
              <strong>{currentUser?.email}</strong>. Sign out and open this link again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => base44.auth.logout()}
              className="w-full rounded-full bg-black hover:bg-stone-800"
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (emailMatches) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              You've been invited to join <strong>{venue?.name}</strong> as a{' '}
              <strong>{invite?.role === 'venue_owner' ? 'Venue Owner' : 'Staff Member'}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-stone-50 rounded-lg p-4 text-sm">
              <p className="text-stone-600">
                <strong>Email:</strong> {invite?.email}
              </p>
              {invite?.name && (
                <p className="text-stone-600 mt-1">
                  <strong>Name:</strong> {invite?.name}
                </p>
              )}
            </div>

            {acceptError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{acceptError}</p>
              </div>
            )}

            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full rounded-full bg-black hover:bg-stone-800"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept invitation'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join <strong>{venue?.name}</strong> as a{' '}
            <strong>{invite?.role === 'venue_owner' ? 'Venue Owner' : 'Staff Member'}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-stone-50 rounded-lg p-4 text-sm">
            <p className="text-stone-600">
              <strong>Email:</strong> {invite?.email}
            </p>
            {invite?.name && (
              <p className="text-stone-600 mt-1">
                <strong>Name:</strong> {invite?.name}
              </p>
            )}
          </div>

          <Button 
            onClick={handleCreateAccount} 
            className="w-full rounded-full bg-black hover:bg-stone-800"
          >
            Create Account
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-stone-500">Or</span>
            </div>
          </div>

          <Button 
            onClick={handleLogin} 
            variant="outline"
            className="w-full rounded-full"
          >
            I Already Have an Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}