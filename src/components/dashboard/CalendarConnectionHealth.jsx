import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CalendarX, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

// Shows how often the Google Calendar OAuth connection has been dropped
// for this venue in the last 30 days. A "drop" = a sync attempt where the
// syncGoogleCalendar function returned status: 'not_connected'.
export default function CalendarConnectionHealth({ venueId }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-sync-events', venueId],
    queryFn: () =>
      venueId
        ? base44.asServiceRole.entities.CalendarSyncEvent.filter({ venue_id: venueId }, '-created_date', 500)
        : [],
    enabled: !!venueId,
  });

  if (!venueId) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recent = events.filter(e => new Date(e.created_date) >= thirtyDaysAgo);
  const drops = recent.filter(e => e.status === 'not_connected');
  const lastDrop = drops[0]; // events are sorted newest-first

  const dropCount = drops.length;
  const totalAttempts = recent.length;
  const isHealthy = dropCount === 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {isHealthy ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
          ) : (
            <CalendarX className="w-6 h-6 text-amber-600 mt-0.5" />
          )}
          <div>
            <h3 className="text-lg font-semibold">Calendar Connection Health</h3>
            <p className="text-sm text-stone-600 mt-1">
              {isLoading
                ? 'Loading…'
                : totalAttempts === 0
                ? 'No sync attempts recorded in the last 30 days.'
                : isHealthy
                ? `Connection has been stable across ${totalAttempts} sync ${totalAttempts === 1 ? 'attempt' : 'attempts'} in the last 30 days.`
                : `Connection dropped ${dropCount} ${dropCount === 1 ? 'time' : 'times'} in the last 30 days${lastDrop ? ` — most recent on ${format(new Date(lastDrop.created_date), 'MMM d, h:mm a')}` : ''}.`}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-3xl font-bold ${isHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
            {dropCount}
          </div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">Drops · 30d</div>
        </div>
      </div>
    </div>
  );
}