import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import GoogleCalendarSync from '../components/admin/GoogleCalendarSync';
import VenueSelector from '../components/admin/VenueSelector';
import { useVenue } from '@/lib/VenueContext';

export default function VenueSettings() {
  // Venue resolution lives in VenueContext so the shell header's switcher and
  // this page can't disagree. It already reads ?venue_id= and auth.me().
  const { user, venueId, setVenueId, userLoading } = useVenue();
  const queryClient = useQueryClient();

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venueId ? base44.entities.Venue.get(venueId) : null,
    enabled: !!venueId
  });

  const updateVenueMutation = useMutation({
    mutationFn: (data) => base44.entities.Venue.update(venueId, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['venue', venueId] });
      // Auto-generate knowledge from structured data
      try {
        await base44.functions.invoke('generateAutoKnowledge', {
          venue_id: venueId,
          source: 'venue_basics'
        });
      } catch (err) {
        console.error('Auto-knowledge generation failed:', err);
        // Don't fail the save — this is a background enhancement
      }
    }
  });

  if (userLoading || !user) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!venueId) {
    if (user.role === 'admin' && !user.venue_id) {
      return <VenueSelector user={user} onVenueSelected={setVenueId} />;
    }
    return (
      <div className="text-center max-w-md mx-auto py-12">
        <h2 className="text-2xl font-bold mb-4">No Venue Assigned</h2>
        <p className="text-stone-600 mb-4">You need to be assigned to a venue to access settings.</p>
        <Link to={createPageUrl(user.role === 'admin' ? 'SuperAdmin' : 'Dashboard')}>
          <Button>Go Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Venue switching is provided by the shared header. */}

        {venue && (
          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Custom Domain</h3>
              <Input
                placeholder="e.g., worldsbestvenue.com"
                value={venue.domain || ''}
                onChange={(e) => updateVenueMutation.mutate({ domain: e.target.value })}
                className="bg-white"
              />
              <p className="text-sm text-blue-800 mt-2">This domain will be used for quote links and tour pages. Contact support to connect your domain.</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Head planner</h3>
              <Input
                placeholder="e.g., Saydee"
                defaultValue={venue.head_planner_name || ''}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (venue.head_planner_name || '')) {
                    updateVenueMutation.mutate({ head_planner_name: v });
                  }
                }}
                className="bg-white"
              />
              <p className="text-sm text-blue-800 mt-2">
                Head planner name. This is who the virtual planner introduces brides to when they want to talk to a human. The planner receives new conversations in your normal HighLevel inbox — make sure you have new-conversation notifications turned on in GHL.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Venue Timezone</h3>
              <select
                value={venue.timezone || 'America/New_York'}
                onChange={(e) => updateVenueMutation.mutate({ timezone: e.target.value })}
                className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl focus:border-black focus:outline-none"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Phoenix">Arizona (no DST)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Anchorage">Alaska Time (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                <option value="America/Puerto_Rico">Atlantic Time (AT)</option>
              </select>
              <p className="text-sm text-blue-800 mt-2">All tour availability and times will display in this timezone</p>
            </div>
          </div>
        )}
        
      <GoogleCalendarSync venueId={venueId} />
    </div>
  );
}
