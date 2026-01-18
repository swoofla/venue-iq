import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, calendarId, venueId } = await req.json();

  try {
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // List all calendars
    if (action === 'list_calendars') {
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
      }

      const data = await response.json();
      const calendars = data.items.map(cal => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description || ''
      }));

      return Response.json({ calendars });
    }

    // Sync events from selected calendar
    if (action === 'sync_calendar') {
      if (!calendarId || !venueId) {
        return Response.json({ error: 'calendarId and venueId required' }, { status: 400 });
      }

      // Fetch events from the selected calendar
      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=250`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch calendar events: ${eventsResponse.statusText}`);
      }

      const eventsData = await eventsResponse.json();
      const events = eventsData.items || [];

      // Create BookedWeddingDate entries from calendar events
      const syncedDates = [];
      for (const event of events) {
        const eventDate = event.start?.date || event.start?.dateTime;
        if (!eventDate) continue;

        // Parse the date
        const dateStr = eventDate.split('T')[0];

        // Extract couple name and details from event title and description
        const title = event.summary || 'Wedding Booking';
        const description = event.description || '';

        const booking = {
          venue_id: venueId,
          date: dateStr,
          couple_name: title,
          email: user.email,
          phone: '',
          guest_count: null,
          notes: description
        };

        try {
          const created = await base44.asServiceRole.entities.BookedWeddingDate.create(booking);
          syncedDates.push({ id: created.id, date: dateStr, couple_name: title });
        } catch (error) {
          console.log(`Skipped duplicate or invalid date: ${dateStr}`);
        }
      }

      return Response.json({ 
        success: true, 
        syncedCount: syncedDates.length,
        syncedDates 
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in syncGoogleCalendar:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});