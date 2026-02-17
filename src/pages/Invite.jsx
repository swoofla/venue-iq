import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, XCircle, Building2 } from 'lucide-react';
import { createPageUrl } from '../utils';

export default function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function validateInvite() {
      if (!token) {
        setError('No invitation token provided');
        setLoading(false);
        return;
      }

      try {
        const invites = await base44.entities.UserInvite.filter({ token });
        
        if (invites.length === 0) {
          setError('Invalid invitation link');
          setLoading(false);
          return;
        }

        const foundInvite = invites[0];

        if (new Date(foundInvite.expires_at) < new Date()) {
          setError('This invitation has expired. Please contact the administrator for a new invite.');
          setLoading(false);
          return;
        }

        if (foundInvite.status === 'accepted') {
          setError('This invitation has already been used. Please log in instead.');
          setLoading(false);
          return;
        }

        const venueData = await base44.entities.Venue.get(foundInvite.venue_id);
        
        setInvite(foundInvite);
        setVenue(venueData);
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