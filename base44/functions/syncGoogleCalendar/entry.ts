import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GOOGLE_CALENDAR_CONNECTOR_ID = '6a2b72d0b1ae3cefb36ece05';

// Convert an event's start (date or dateTime) into a YYYY-MM-DD string in the venue's timezone.
function eventDateInTz(event, timeZone) {
  // All-day events use event.start.date already as YYYY-MM-DD — return as-is.
  if (event.start?.date) return event.start.date;
  const dt = event.start?.dateTime;
  if (!dt) return null;
  try {
    const d = new Date(dt);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (!y || !m || !day) return null;
    return `${y}-${m}-${day}`;
  } catch (_) {
    return null;
  }
}

// Google end dates/times are exclusive. Walk calendar dates, not 24-hour
// increments in the venue timezone, so daylight-saving changes do not skip days.
function eventDatesInTz(event, timeZone) {
  if (event.status === 'cancelled') return [];
  const first = eventDateInTz(event, timeZone);
  if (!first) return [];
  let last = first;
  if (event.start?.date && event.end?.date) {
    const end = Date.parse(event.end.date + 'T00:00:00Z');
    if (!Number.isFinite(end) || event.end.date <= first) return [];
    last = new Date(end - 1).toISOString().slice(0, 10);
  } else if (event.start?.dateTime && event.end?.dateTime) {
    const start = Date.parse(event.start.dateTime);
    const end = Date.parse(event.end.dateTime);
    if (!Number.isFinite(end) || end <= start) return [];
    last = eventDateInTz({ start: { dateTime: new Date(end - 1).toISOString() } }, timeZone);
  }
  if (!last || last < first) return [];
  const dates = [];
  const cursor = new Date(first + 'T00:00:00Z');
  while (cursor.toISOString().slice(0, 10) <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, calendarId, venueId } = await req.json();
    if (action === 'sync_calendar' && user.role !== 'admin' && (!user.venue_id || user.venue_id !== venueId)) {
      return Response.json({ error: 'You can only sync the calendar for your assigned venue.' }, { status: 403 });
    }

    // Fire-and-forget audit log — never let a logging failure break the sync.
    const logSyncEvent = (status, errorMessage) => {
      try {
        base44.asServiceRole.entities.CalendarSyncEvent.create({
          venue_id: venueId || undefined,
          action: action || 'sync_calendar',
          status,
          error_message: errorMessage || undefined,
          user_id: user?.id || undefined,
        }).catch((e) => console.log(`CalendarSyncEvent log failed: ${e.message}`));
      } catch (e) {
        console.log(`CalendarSyncEvent log threw: ${e.message}`);
      }
    };

    // Get the current app user's Google Calendar connection.
    // If absent, return a clear not_connected status (NOT a 500).
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GOOGLE_CALENDAR_CONNECTOR_ID);
      accessToken = conn?.accessToken;
      if (!accessToken) {
        logSyncEvent('not_connected');
        return Response.json({ status: 'not_connected' });
      }
    } catch (_) {
      logSyncEvent('not_connected');
      return Response.json({ status: 'not_connected' });
    }

    if (action === 'list_calendars') {
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (response.status === 401 || response.status === 403) {
        logSyncEvent('not_connected');
        return Response.json({ status: 'not_connected' });
      }
      if (!response.ok) {
        const text = await response.text();
        logSyncEvent('error', `Google API error: ${response.status} ${text}`);
        return Response.json({ error: `Google API error: ${response.status} ${text}` }, { status: 502 });
      }
      const data = await response.json();
      const calendars = (data.items || []).map(cal => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description || ''
      }));
      logSyncEvent('connected');
      return Response.json({ status: 'connected', calendars });
    }

    if (action === 'sync_calendar') {
      if (!calendarId || !venueId) {
        return Response.json({ error: 'calendarId and venueId required' }, { status: 400 });
      }

      // Persist the selected calendarId on the Venue so future syncs reuse it.
      try {
        await base44.asServiceRole.entities.Venue.update(venueId, { google_calendar_id: calendarId });
      } catch (e) {
        console.log(`Failed to persist google_calendar_id on venue ${venueId}: ${e.message}`);
      }

      // Get the venue for timezone resolution.
      let venueTz = 'America/New_York';
      try {
        const v = await base44.asServiceRole.entities.Venue.get(venueId);
        if (v?.timezone) venueTz = v.timezone;
      } catch (_) { /* fall through with default */ }

      // Window: today through today + 3 years (RFC3339).
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const timeMaxDate = new Date(now.getFullYear() + 3, now.getMonth(), now.getDate());
      const timeMax = timeMaxDate.toISOString();

      // Page through events until nextPageToken is exhausted.
      const events = [];
      let pageToken = null;
      let pagesFetched = 0;
      do {
        const params = new URLSearchParams({
          maxResults: '2500',
          singleEvents: 'true',
          orderBy: 'startTime',
          timeMin,
          timeMax,
        });
        if (pageToken) params.set('pageToken', pageToken);

        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (eventsResponse.status === 401 || eventsResponse.status === 403) {
          logSyncEvent('not_connected');
          return Response.json({ status: 'not_connected' });
        }
        if (!eventsResponse.ok) {
          const text = await eventsResponse.text();
          logSyncEvent('error', `Failed to fetch calendar events: ${eventsResponse.status} ${text}`);
          return Response.json({ error: `Failed to fetch calendar events: ${eventsResponse.status} ${text}` }, { status: 502 });
        }
        const eventsData = await eventsResponse.json();
        if (Array.isArray(eventsData.items)) events.push(...eventsData.items);
        pageToken = eventsData.nextPageToken || null;
        pagesFetched += 1;
        if (pagesFetched > 50) break; // hard safety cap
      } while (pageToken);

      const eventsFound = events.length;

      const existing = await base44.asServiceRole.entities.BookedWeddingDate.filter({ venue_id: venueId });
      let recordsCreated = 0;
      let recordsUpdated = 0;
      let recordsMerged = 0;
      let skippedExisting = 0;
      let skippedNoDate = 0;
      for (const event of events) {
        if (!event.id || event.status === 'cancelled') continue;
        const dates = eventDatesInTz(event, venueTz);
        if (!dates.length) { skippedNoDate += 1; continue; }
        const matches = existing.filter(row => !row.merged_into_id && row.google_event_id === event.id && (!row.google_calendar_id || row.google_calendar_id === calendarId))
          .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
        const primary = matches[0];
        const range = { date: dates[0], end_date: dates[dates.length - 1], google_calendar_id: calendarId };
        if (primary) {
          // Preserve names, notes, contact details and deposit information edited in the app.
          if (primary.date !== range.date || primary.end_date !== range.end_date || primary.google_calendar_id !== calendarId) {
            await base44.asServiceRole.entities.BookedWeddingDate.update(primary.id, range);
            Object.assign(primary, range);
            recordsUpdated += 1;
          } else { skippedExisting += 1; }
          for (const duplicate of matches.slice(1)) {
            await base44.asServiceRole.entities.BookedWeddingDate.update(duplicate.id, { merged_into_id: primary.id });
            duplicate.merged_into_id = primary.id;
            recordsMerged += 1;
          }
        } else {
          const created = await base44.asServiceRole.entities.BookedWeddingDate.create({
            venue_id: venueId, ...range,
            couple_name: event.summary || 'Wedding Booking', google_event_id: event.id,
          });
          existing.push(created);
          recordsCreated += 1;
        }
      }

      logSyncEvent('connected');
      return Response.json({
        status: 'connected',
        success: true,
        eventsFound,
        recordsCreated,
        recordsUpdated,
        recordsMerged,
        skippedExisting,
        skippedNoDate,
        venueId,
        calendarId,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in syncGoogleCalendar:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});