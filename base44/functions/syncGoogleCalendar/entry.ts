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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, calendarId, venueId } = await req.json();

    // Get the current app user's Google Calendar connection.
    // If absent, return a clear not_connected status (NOT a 500).
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GOOGLE_CALENDAR_CONNECTOR_ID);
      accessToken = conn?.accessToken;
      if (!accessToken) {
        return Response.json({ status: 'not_connected' });
      }
    } catch (_) {
      return Response.json({ status: 'not_connected' });
    }

    if (action === 'list_calendars') {
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (response.status === 401 || response.status === 403) {
        return Response.json({ status: 'not_connected' });
      }
      if (!response.ok) {
        const text = await response.text();
        return Response.json({ error: `Google API error: ${response.status} ${text}` }, { status: 502 });
      }
      const data = await response.json();
      const calendars = (data.items || []).map(cal => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description || ''
      }));
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
          return Response.json({ status: 'not_connected' });
        }
        if (!eventsResponse.ok) {
          const text = await eventsResponse.text();
          return Response.json({ error: `Failed to fetch calendar events: ${eventsResponse.status} ${text}` }, { status: 502 });
        }
        const eventsData = await eventsResponse.json();
        if (Array.isArray(eventsData.items)) events.push(...eventsData.items);
        pageToken = eventsData.nextPageToken || null;
        pagesFetched += 1;
        if (pagesFetched > 50) break; // hard safety cap
      } while (pageToken);

      const eventsFound = events.length;

      // Load existing BookedWeddingDates for this venue to dedupe by BOTH
      // google_event_id AND date (so we don't clobber manually-entered dates).
      const existing = await base44.asServiceRole.entities.BookedWeddingDate.filter({ venue_id: venueId });
      const existingEventIds = new Set(existing.map(b => b.google_event_id).filter(Boolean));
      const existingDates = new Set(existing.map(b => b.date).filter(Boolean));

      const bookingsToCreate = [];
      const usedDatesThisRun = new Set(); // avoid duplicates within the same batch
      let skippedExisting = 0;
      let skippedNoDate = 0;

      for (const event of events) {
        if (!event.id) continue;
        const dateStr = eventDateInTz(event, venueTz);
        if (!dateStr) {
          skippedNoDate += 1;
          continue;
        }
        if (existingEventIds.has(event.id) || existingDates.has(dateStr) || usedDatesThisRun.has(dateStr)) {
          skippedExisting += 1;
          continue;
        }
        usedDatesThisRun.add(dateStr);
        bookingsToCreate.push({
          venue_id: venueId,
          date: dateStr,
          couple_name: event.summary || 'Wedding Booking',
          google_event_id: event.id,
        });
      }

      let recordsCreated = 0;
      if (bookingsToCreate.length > 0) {
        try {
          const created = await base44.asServiceRole.entities.BookedWeddingDate.bulkCreate(bookingsToCreate);
          recordsCreated = Array.isArray(created) ? created.length : bookingsToCreate.length;
        } catch (error) {
          console.log(`Bulk create error: ${error.message} — falling back to individual creates`);
          for (const booking of bookingsToCreate) {
            try {
              await base44.asServiceRole.entities.BookedWeddingDate.create(booking);
              recordsCreated += 1;
            } catch (e) {
              console.log(`Skipped ${booking.date}: ${e.message}`);
            }
          }
        }
      }

      return Response.json({
        status: 'connected',
        success: true,
        eventsFound,
        recordsCreated,
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