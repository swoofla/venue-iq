import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Loader2, LogOut } from 'lucide-react';

export default function GoogleCalendarSync({ venueId }) {
  const [isConnected, setIsConnected] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendar, setSelectedCalendar] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await base44.functions.invoke('syncGoogleCalendar', {
        action: 'list_calendars'
      });
      setCalendars(data.calendars);
      setIsConnected(true);
    } catch (err) {
      setError('Failed to connect to Google Calendar. Please try again.');
      console.error(err);
    }
    setLoading(false);
  };

  const handleSync = async () => {
    if (!selectedCalendar) {
      setError('Please select a calendar');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      const { data } = await base44.functions.invoke('syncGoogleCalendar', {
        action: 'sync_calendar',
        calendarId: selectedCalendar,
        venueId
      });
      setSyncResult({
        count: data.syncedCount,
        success: true,
        venueId: data.venueId
      });
    } catch (err) {
      setError('Failed to sync calendar. Please try again.');
      console.error(err);
    }
    setSyncing(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setCalendars([]);
    setSelectedCalendar('');
    setSyncResult(null);
    setError(null);
  };

  if (!isConnected) {
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
        <Button onClick={handleConnect} disabled={loading}>
          {loading ? (
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          className="gap-2"
        >
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

      {syncResult && syncResult.success && (
        <div className="flex gap-2 items-start mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-700">
            <p>Successfully synced {syncResult.count} wedding date{syncResult.count !== 1 ? 's' : ''} from your calendar</p>
            <p className="text-xs text-green-600 mt-1">Venue ID: {syncResult.venueId}</p>
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

        <Button 
          onClick={handleSync} 
          disabled={!selectedCalendar || syncing}
          className="w-full"
        >
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