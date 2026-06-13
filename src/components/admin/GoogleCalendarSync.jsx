import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Loader2, LogOut, RefreshCw } from 'lucide-react';

const GOOGLE_CALENDAR_CONNECTOR_ID = '6a2b72d0b1ae3cefb36ece05';

export default function GoogleCalendarSync({ venueId }) {
  const [authed, setAuthed] = useState(null); // null = unknown, true/false once known
  const [status, setStatus] = useState('loading'); // loading | not_connected | reconnect_needed | connecting | connected
  const [previouslyConnected, setPreviouslyConnected] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendar, setSelectedCalendar] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  // Rule 2: reusable fetch that doubles as a connection check + data loader.
  // If the venue has a saved google_calendar_id, "not_connected" means the token
  // was revoked/expired (Google does this periodically) → show "reconnect_needed"
  // instead of the plain first-time connect screen.
  const refreshConnection = useCallback(async () => {
    setError(null);

    // Read the venue's saved calendar id FIRST so we can distinguish
    // "never connected" from "previously connected, token revoked".
    let savedCalendarId = null;
    try {
      const venue = await base44.entities.Venue.get(venueId);
      savedCalendarId = venue?.google_calendar_id || null;
    } catch (_) { /* non-fatal */ }
    setPreviouslyConnected(!!savedCalendarId);

    try {
      const res = await base44.functions.invoke('syncGoogleCalendar', { action: 'list_calendars' });
      const data = res?.data || {};
      if (data.status === 'not_connected') {
        setCalendars([]);
        setStatus(savedCalendarId ? 'reconnect_needed' : 'not_connected');
        return;
      }
      if (data.status === 'connected' && Array.isArray(data.calendars)) {
        setCalendars(data.calendars);
        setStatus('connected');
        if (savedCalendarId && data.calendars.some(c => c.id === savedCalendarId)) {
          setSelectedCalendar(savedCalendarId);
        }
        return;
      }
      if (data.error) {
        setError(data.error);
        setStatus(savedCalendarId ? 'reconnect_needed' : 'not_connected');
        return;
      }
      setStatus(savedCalendarId ? 'reconnect_needed' : 'not_connected');
    } catch (err) {
      // Network or 5xx — treat as not connected so the user can retry.
      console.error('refreshConnection error:', err);
      setStatus(savedCalendarId ? 'reconnect_needed' : 'not_connected');
    }
  }, [venueId]);

  // Rule 1 + 2: check auth, then probe the connector.
  useEffect(() => {
    (async () => {
      const isAuth = await base44.auth.isAuthenticated();
      setAuthed(isAuth);
      if (isAuth) {
        await refreshConnection();
      } else {
        setStatus('not_connected');
      }
    })();
  }, [refreshConnection]);

  // Rule 3: open OAuth in a popup, poll until it closes, then re-check status.
  const handleConnect = async () => {
    setError(null);
    setStatus('connecting');
    try {
      const url = await base44.connectors.connectAppUser(GOOGLE_CALENDAR_CONNECTOR_ID);
      const popup = window.open(url, '_blank', 'width=500,height=700');
      if (!popup) {
        setError('Popup blocked. Please allow popups for this site and try again.');
        setStatus('not_connected');
        return;
      }
      const timer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(timer);
          await refreshConnection();
        }
      }, 500);
    } catch (err) {
      console.error('connectAppUser error:', err);
      setError(err?.message || 'Could not start the Google Calendar connection.');
      setStatus('not_connected');
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await base44.connectors.disconnectAppUser(GOOGLE_CALENDAR_CONNECTOR_ID);
    } catch (err) {
      console.error('disconnectAppUser error:', err);
    }
    setCalendars([]);
    setSelectedCalendar('');
    setSyncResult(null);
    setPreviouslyConnected(false);
    setStatus('not_connected');
  };

  const handleSync = async () => {
    if (!selectedCalendar) {
      setError('Please select a calendar');
      return;
    }
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncGoogleCalendar', {
        action: 'sync_calendar',
        calendarId: selectedCalendar,
        venueId,
      });
      const data = res?.data || {};
      if (data.status === 'not_connected') {
        setStatus('not_connected');
        setError('Your Google Calendar session expired. Please reconnect.');
      } else if (data.error) {
        setError(data.error);
      } else {
        setSyncResult({
          eventsFound: data.eventsFound || 0,
          recordsCreated: data.recordsCreated || 0,
          skippedExisting: data.skippedExisting || 0,
        });
      }
    } catch (err) {
      console.error('sync error:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to sync calendar.');
    }
    setSyncing(false);
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (status === 'loading' || authed === null) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 flex items-center gap-2 text-sm text-stone-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking Google Calendar connection...
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
        <h3 className="font-semibold mb-2">Google Calendar Integration</h3>
        <p className="text-sm text-stone-600 mb-4">Please sign in to connect your Google Calendar.</p>
        <Button onClick={() => base44.auth.redirectToLogin()}>Sign in</Button>
      </div>
    );
  }

  if (status === 'reconnect_needed') {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
        <div className="flex gap-2 items-start mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Reconnect needed</p>
            <p className="mt-1">
              Your Google Calendar connection has expired or been revoked. This happens periodically — just reconnect to resume syncing.
            </p>
          </div>
        </div>
        {error && (
          <div className="flex gap-2 items-start mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
        <Button onClick={handleConnect} disabled={status === 'connecting'} className="gap-2">
          {status === 'connecting' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Reconnecting...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Reconnect Google Calendar
            </>
          )}
        </Button>
      </div>
    );
  }

  if (status !== 'connected') {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
        <h3 className="font-semibold mb-2">Google Calendar Integration</h3>
        <p className="text-sm text-stone-600 mb-4">
          Connect your Google Calendar to automatically sync wedding bookings. You'll be able to select which specific calendar to sync.
        </p>
        {error && (
          <div className="flex gap-2 items-start mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
        <Button onClick={handleConnect} disabled={status === 'connecting'}>
          {status === 'connecting' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect Google Calendar'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold">Google Calendar Connected</h3>
          <p className="text-sm text-stone-600 mt-1">Select a calendar to sync with your bookings</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDisconnect} className="gap-2">
          <LogOut className="w-4 h-4" />
          Disconnect
        </Button>
      </div>

      {error && (
        <div className="flex gap-2 items-start mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {syncResult && (
        <div className="flex gap-2 items-start mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-700">
            <p>
              Found {syncResult.eventsFound} event{syncResult.eventsFound !== 1 ? 's' : ''} — added {syncResult.recordsCreated} new date{syncResult.recordsCreated !== 1 ? 's' : ''}
              {syncResult.skippedExisting > 0 && ` (${syncResult.skippedExisting} already existed)`}.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-2">Select Calendar</label>
          <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a calendar..." />
            </SelectTrigger>
            <SelectContent>
              {calendars.map(cal => (
                <SelectItem key={cal.id} value={cal.id}>
                  {cal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSync} disabled={!selectedCalendar || syncing} className="w-full">
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            'Sync Calendar Events'
          )}
        </Button>
      </div>
    </div>
  );
}